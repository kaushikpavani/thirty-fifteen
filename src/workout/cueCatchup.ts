import { CLOCK_HIT_MS, rockyCue, WARN_BEFORE_MS, type RockySegment } from '../audio/rocky';
import { ladderArmed, ladderSkipped, type LadderStep } from '../audio/spirit';

/**
 * How far a single tick may jump and still play a cue whose window it crossed.
 * Longer gaps mean the process was suspended: snap to the wall clock and play
 * only a cue we are still inside, so a resumed ride does not dump a backlog.
 */
export const CUE_CATCH_UP_GAP_MS = 2_000;

export type DueChirp = {
  type: 'chirp';
  key: string;
  segmentId: string;
  kind: string;
  index: number;
  atMs: number;
};

export type DueWarn = {
  type: 'warn';
  key: string;
  segmentId: string;
  atMs: number;
};

export type DueLadder = {
  type: 'ladder';
  key: string;
  step: LadderStep;
  segmentId: string;
  approach: number;
  /** What this ladder counts into — lets the T−3 rung swap in a heads-up line for an acceleration. */
  nextKind: string | null;
  atMs: number;
};

export type DueRocky = {
  type: 'rocky';
  key: string;
  line: string;
  clip: string;
  /** HARD rep number, so a numbers-only coach can say it. */
  rep?: number;
  atMs: number;
};

export type DueRemaining = {
  type: 'remaining';
  key: string;
  clip: string;
  minutes: number;
  atMs: number;
};

export type DueCue = DueChirp | DueWarn | DueLadder | DueRocky | DueRemaining;

/**
 * "X minutes left" thresholds, called out against total ride time remaining —
 * not the current segment. A rider with the phone in a pocket has no other
 * way to know how much of the ride is left.
 */
export const REMAINING_THRESHOLDS_MS: { minutes: number; ms: number }[] = [
  { minutes: 10, ms: 600_000 },
  { minutes: 5, ms: 300_000 },
  { minutes: 2, ms: 120_000 },
  { minutes: 1, ms: 60_000 },
];

/** The warm-up must be at least this long before "one minute of warm-up left" is worth saying. */
export const WARMUP_NOTICE_MIN_MS = 180_000;

/** Mark a cue played. False when that key is already in the set, so it cannot speak twice. */
export function takeCue(firedClock: Set<string>, firedRocky: Set<string>, cue: DueCue): boolean {
  const bucket = cue.type === 'rocky' ? firedRocky : firedClock;
  if (bucket.has(cue.key)) return false;
  bucket.add(cue.key);
  return true;
}

type Window = { start: number; end: number };

/** (from, to] crosses [start, end). `from` was already delivered. */
function crosses(from: number, to: number, window: Window): boolean {
  return to > from && to >= window.start && from < window.end;
}

function keep(from: number, to: number, window: Window, maxGap: number): boolean {
  if (!crosses(from, to, window)) return false;
  if (to - from <= maxGap) return true;
  return to >= window.start && to < window.end;
}

function chirpWindow(segmentStart: number): Window {
  return { start: segmentStart, end: segmentStart + CLOCK_HIT_MS };
}

function leadWindow(segmentEnd: number, leadMs: number): Window {
  const start = segmentEnd - leadMs;
  return { start, end: start + CLOCK_HIT_MS };
}

const LADDER_LEAD: Record<LadderStep, number> = {
  three: 3_000,
  two: 2_000,
  one: 1_000,
};

/**
 * Rocky windows, integer ms, matching rockyCue.
 * Welcome (1000, 1800]. Hard [10s, 12s). Easy (1s, 3s]. Finish (1s, 2.2s].
 */
function rockyWindows(segments: RockySegment[]): { key: string; window: Window }[] {
  const out: { key: string; window: Window }[] = [{ key: 'welcome', window: { start: 1_001, end: 1_801 } }];
  let acc = 0;
  let lastMain = -1;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if ((seg.kind === 'hard' || seg.kind === 'easy') && seg.repNumber != null) lastMain = i;
  }
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const start = acc;
    acc += seg.durationMs;
    if (seg.kind === 'hard') {
      out.push({ key: `hard:${seg.id}`, window: { start: start + 10_000, end: start + 12_000 } });
    }
    if (seg.kind === 'easy') {
      out.push({ key: `easy:${seg.id}`, window: { start: start + 1_001, end: start + 3_001 } });
    }
    if (lastMain >= 0 && i === lastMain + 1) {
      out.push({ key: 'finish', window: { start: start + 1_001, end: start + 2_201 } });
    }
  }
  return out;
}

function approachIntoNext(segments: RockySegment[], index: number, nextKind: string | null): number {
  if (nextKind !== 'hard') return 0;
  let approach = 0;
  for (let i = 0; i <= index; i++) if (segments[i]?.kind === 'hard') approach += 1;
  return approach;
}

/**
 * Cues whose windows the playhead crossed between `fromMs` and `toMs`.
 * One chirp, one ladder rung, one warn, and one Rocky line per flush: the latest
 * of each. A boundary chirp drops rungs that already expired. Rocky is resolved
 * by rockyCue so variety stays on the rep and the session salt. On a normal
 * 30/15 the 2s window holds only one of each, so this does not move the clock.
 */
export function cuesDue(args: {
  segments: RockySegment[];
  fromMs: number;
  toMs: number;
  firedClock: ReadonlySet<string>;
  firedRocky: ReadonlySet<string>;
  salt?: number;
  maxGapMs?: number;
  /** A spoken count-in needs all three rungs every time, so no skipped ladders. */
  fullLadder?: boolean;
}): DueCue[] {
  const { segments, fromMs, toMs, firedClock, firedRocky } = args;
  const salt = args.salt ?? 0;
  const maxGap = args.maxGapMs ?? CUE_CATCH_UP_GAP_MS;
  if (!(toMs > fromMs) || segments.length === 0) return [];

  const clock: DueCue[] = [];
  let acc = 0;
  for (let index = 0; index < segments.length; index++) {
    const seg = segments[index];
    const start = acc;
    const end = acc + seg.durationMs;
    acc = end;
    const nextKind = segments[index + 1]?.kind ?? null;

    const chirpKey = `chirp:${seg.id}`;
    if (!firedClock.has(chirpKey) && keep(fromMs, toMs, chirpWindow(start), maxGap)) {
      clock.push({
        type: 'chirp',
        key: chirpKey,
        segmentId: seg.id,
        kind: seg.kind,
        index,
        atMs: start,
      });
    }

    if (!ladderArmed(seg.durationMs, nextKind)) continue;
    const approach = approachIntoNext(segments, index, nextKind);
    if (!args.fullLadder && ladderSkipped(approach)) {
      const warnKey = `warn:${seg.id}`;
      const window = leadWindow(end, WARN_BEFORE_MS);
      if (!firedClock.has(warnKey) && keep(fromMs, toMs, window, maxGap)) {
        clock.push({ type: 'warn', key: warnKey, segmentId: seg.id, atMs: window.start });
      }
      continue;
    }

    for (const step of ['three', 'two', 'one'] as const) {
      const key = `ladder:${seg.id}:${step}`;
      const window = leadWindow(end, LADDER_LEAD[step]);
      if (firedClock.has(key) || !keep(fromMs, toMs, window, maxGap)) continue;
      clock.push({
        type: 'ladder',
        key,
        step,
        segmentId: seg.id,
        approach,
        nextKind,
        atMs: window.start,
      });
    }
  }

  const chirps = clock.filter((cue): cue is DueChirp => cue.type === 'chirp');
  const latestChirp = chirps.reduce<DueChirp | null>(
    (best, cue) => (best == null || cue.atMs >= best.atMs ? cue : best),
    null,
  );
  const boundary = latestChirp?.atMs ?? Number.NEGATIVE_INFINITY;
  const fresh = (cue: DueCue) => boundary === Number.NEGATIVE_INFINITY || cue.atMs >= boundary;
  const ladders = clock.filter((cue): cue is DueLadder => cue.type === 'ladder' && fresh(cue));
  const latestLadder = ladders.reduce<DueLadder | null>(
    (best, cue) => (best == null || cue.atMs >= best.atMs ? cue : best),
    null,
  );
  const warns = clock.filter((cue): cue is DueWarn => cue.type === 'warn' && fresh(cue));
  const latestWarn = warns.reduce<DueWarn | null>(
    (best, cue) => (best == null || cue.atMs >= best.atMs ? cue : best),
    null,
  );

  const rockyHits: DueRocky[] = [];
  for (const candidate of rockyWindows(segments)) {
    if (firedRocky.has(candidate.key)) continue;
    if (!keep(fromMs, toMs, candidate.window, maxGap)) continue;
    const inside = toMs >= candidate.window.start && toMs < candidate.window.end;
    const sample = inside ? toMs : candidate.window.end - 1;
    const cue = rockyCue({ elapsedMs: sample, segments, fired: firedRocky, salt });
    if (!cue || cue.key !== candidate.key) continue;
    rockyHits.push({ type: 'rocky', key: cue.key, line: cue.line, clip: cue.clip, rep: cue.rep, atMs: candidate.window.start });
  }
  const rocky = rockyHits.reduce<DueRocky | null>(
    (best, cue) => (best == null || cue.atMs >= best.atMs ? cue : best),
    null,
  );

  const total = acc;
  const remainingHits: DueRemaining[] = [];
  for (const threshold of REMAINING_THRESHOLDS_MS) {
    if (total <= threshold.ms) continue; // ride is shorter than this call-out; skip it entirely
    const key = `remaining:${threshold.minutes}`;
    const window = { start: total - threshold.ms, end: total - threshold.ms + CLOCK_HIT_MS };
    if (firedClock.has(key) || !keep(fromMs, toMs, window, maxGap)) continue;
    remainingHits.push({ type: 'remaining', key, clip: `left${threshold.minutes}`, minutes: threshold.minutes, atMs: window.start });
  }
  // One minute before the first hard rep, when the warm-up is long enough for that to be news.
  let firstHard = 0;
  for (const seg of segments) {
    if (seg.kind === 'hard') break;
    firstHard += seg.durationMs;
  }
  if (firstHard < total && firstHard >= WARMUP_NOTICE_MIN_MS) {
    const key = 'warmup:left1';
    const window = { start: firstHard - 60_000, end: firstHard - 60_000 + CLOCK_HIT_MS };
    if (!firedClock.has(key) && keep(fromMs, toMs, window, maxGap)) {
      remainingHits.push({ type: 'remaining', key, clip: 'warmup1left', minutes: 1, atMs: window.start });
    }
  }
  const remaining = remainingHits.reduce<DueRemaining | null>(
    (best, cue) => (best == null || cue.atMs >= best.atMs ? cue : best),
    null,
  );

  const due: DueCue[] = [];
  if (latestChirp) due.push(latestChirp);
  if (latestWarn) due.push(latestWarn);
  if (latestLadder) due.push(latestLadder);
  if (rocky) due.push(rocky);
  if (remaining) due.push(remaining);
  due.sort((a, b) => a.atMs - b.atMs || a.key.localeCompare(b.key));
  return due;
}
