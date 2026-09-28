/** Spoken only. Never render these strings. */

export const SILENCE_AFTER_MS = 1000;
export const SILENCE_BEFORE_MS = 3000;

/**
 * The coach says less, and says it on time. These are the Calm lines; every
 * voice speaks the same clip keys (see voices.ts), so timing never depends on
 * who is talking.
 */
export const ROCKY_WELCOME = 'Warm-up. Easy spin to start.';
/** Pool for HARD reps that are not a milestone. Consecutive reps never share a line. */
export const HARD_LINES = [
  'Hold it.',
  'Smooth and strong.',
  'Quick feet.',
  'Relax your shoulders.',
  'Stay on it.',
] as const;
export const EASY_LINES = ['Breathe.', 'Spin easy.', 'Good.'] as const;
/** Rep-aware lines. The coach knows where you are. */
export const HALFWAY = 'Halfway.';
export const THREE_TO_GO = 'Three to go.';
export const LAST_ONE = 'Last one. Empty it.';
export const ROCKY_HARD = HARD_LINES[0];
export const ROCKY_EASY = EASY_LINES[0];
/** Fixed. Not a pool. */
export const ROCKY_FINISH = "That's the work. Cool down, easy spin.";
/** One syllable on the first HARD chirp. Fixed. Never skipped. */
export const ROCKY_GO = 'Go.';
/** Once, when the last easy of a set opens the set rest. Fixed. */
export const ROCKY_ROUND = 'Set done. Spin easy, and drink.';

export type LineTake = { line: string; clip: string };

/** Every fourth easy is quiet, shifted by the session. 25% — inside 20–30%. */
export function easySpeaks(ordinal: number, salt = 0): boolean {
  return (ordinal + salt) % 4 !== 3;
}

/** Milestone for this rep of a set, if any. Wins over the pool and over silence. */
export function milestone(rep: number | undefined, reps: number): LineTake | null {
  if (rep == null || reps < 4) return null;
  if (rep === reps) return { line: LAST_ONE, clip: 'last' };
  if (reps >= 8 && rep === reps - 2) return { line: THREE_TO_GO, clip: 'three' };
  if (reps >= 6 && rep === Math.ceil(reps / 2) + (reps % 2 === 0 ? 1 : 0)) return { line: HALFWAY, clip: 'halfway' };
  return null;
}

/** Plain HARD reps: every fourth is quiet, and never the first of a set. */
export function hardSpeaks(ordinal: number, salt = 0, rep?: number): boolean {
  if (rep === 1) return true;
  return (ordinal + salt) % 4 !== 2;
}

export function hardTake(ordinal: number, salt = 0, rep?: number, reps = 0): LineTake | null {
  const mark = milestone(rep, reps);
  if (mark) return mark;
  if (!hardSpeaks(ordinal, salt, rep)) return null;
  const index = (ordinal + salt) % HARD_LINES.length;
  return { line: HARD_LINES[index], clip: `hard${index}` };
}

export function easyTake(ordinal: number, salt = 0): LineTake | null {
  if (!easySpeaks(ordinal, salt)) return null;
  const index = (ordinal + salt) % EASY_LINES.length;
  return { line: EASY_LINES[index], clip: `easy${index}` };
}

export function roundTake(): LineTake {
  return { line: ROCKY_ROUND, clip: 'round0' };
}

export function finishTake(): LineTake {
  return { line: ROCKY_FINISH, clip: 'finish0' };
}

/** How long a phase-start chirp or a T−3 warn stays eligible, matching the 100ms tick. */
export const CLOCK_HIT_MS = 400;
export const WARN_BEFORE_MS = 3000;

export type ClockHit = 'chirp' | 'warn';

/**
 * Clock hits, separate from Rocky.
 * Chirp in the first 400ms of a segment. Warn in the 400ms window that opens at T−3.
 * Segments shorter than the warn lead only chirp, so the two never stack.
 */
export function clockHit(elapsedInMs: number, durationMs: number): ClockHit | null {
  if (elapsedInMs >= 0 && elapsedInMs < CLOCK_HIT_MS) return 'chirp';
  const remaining = durationMs - elapsedInMs;
  const warnOpens = durationMs > WARN_BEFORE_MS + CLOCK_HIT_MS;
  if (warnOpens && remaining <= WARN_BEFORE_MS && remaining > WARN_BEFORE_MS - CLOCK_HIT_MS) return 'warn';
  return null;
}

export type RockySegment = {
  id: string;
  kind: string;
  durationMs: number;
  repNumber?: number;
};

export type RockyCue = { key: string; line: string; clip: string; rep?: number };

export function inSegmentSilence(elapsedInMs: number, durationMs: number): boolean {
  if (elapsedInMs <= SILENCE_AFTER_MS) return true;
  if (durationMs - elapsedInMs <= SILENCE_BEFORE_MS) return true;
  return false;
}

function lastMainIndex(segments: RockySegment[]): number {
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if ((seg.kind === 'hard' || seg.kind === 'easy') && seg.repNumber != null) return i;
  }
  return -1;
}

/**
 * One Rocky line, or nothing.
 * Welcome once just after the opening silence.
 * Hard lines at 10–12s into a 30. Easy lines after the opening second and by 3s.
 * Finish once, one second after the last interval. Silent from T−3 through T+1.
 */
export function rockyCue(args: {
  elapsedMs: number;
  segments: RockySegment[];
  fired: ReadonlySet<string>;
  /** Session offset. Defaults to the first take so a missing clock still speaks. */
  salt?: number;
}): RockyCue | null {
  const { elapsedMs, segments, fired, salt = 0 } = args;
  let acc = 0;
  let hardOrdinal = 0;
  let easyOrdinal = 0;
  let reps = 0;
  for (const seg of segments) if (seg.kind === 'hard' && seg.repNumber != null) reps = Math.max(reps, seg.repNumber);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const start = acc;
    const end = acc + seg.durationMs;
    acc = end;
    const thisHard = hardOrdinal;
    const thisEasy = easyOrdinal;
    if (seg.kind === 'hard') hardOrdinal += 1;
    if (seg.kind === 'easy') easyOrdinal += 1;
    if (elapsedMs < start || elapsedMs >= end) continue;

    const elapsedIn = elapsedMs - start;
    if (inSegmentSilence(elapsedIn, seg.durationMs)) return null;

    if (elapsedMs > SILENCE_AFTER_MS && elapsedMs <= 1800 && !fired.has('welcome')) {
      return { key: 'welcome', line: ROCKY_WELCOME, clip: 'welcome' };
    }

    if (
      seg.kind === 'hard' &&
      elapsedIn >= 10_000 &&
      elapsedIn < 12_000 &&
      !fired.has(`hard:${seg.id}`)
    ) {
      const take = hardTake(thisHard, salt, seg.repNumber, reps);
      if (!take) return null;
      return { key: `hard:${seg.id}`, line: take.line, clip: take.clip, rep: seg.repNumber };
    }

    if (
      seg.kind === 'easy' &&
      elapsedIn > SILENCE_AFTER_MS &&
      elapsedIn <= 3000 &&
      !fired.has(`easy:${seg.id}`)
    ) {
      const take = easyTake(thisEasy, salt);
      if (!take) return null;
      return { key: `easy:${seg.id}`, line: take.line, clip: take.clip };
    }

    const last = lastMainIndex(segments);
    if (last >= 0 && i === last + 1 && elapsedIn > SILENCE_AFTER_MS && elapsedIn <= 2200 && !fired.has('finish')) {
      const take = finishTake();
      return { key: 'finish', line: take.line, clip: take.clip };
    }

    return null;
  }
  return null;
}
