/** Spoken only. Never render these strings. */

export const SILENCE_AFTER_MS = 1000;
export const SILENCE_BEFORE_MS = 3000;

export const ROCKY_WELCOME = "Let's go. Time to get better.";
/** One per HARD. Consecutive reps never share a line. */
export const HARD_LINES = [
  'Dig in — this is the round that builds you.',
  "Hold the line. You're in it.",
  'This is the work. Stay with it.',
  'Chin up. Push the watts.',
] as const;
export const EASY_LINES = [
  "Yes. Breathe fire. You're not done.",
  'Easy. Reload.',
  "Good. Next one's yours.",
] as const;
export const ROCKY_HARD = HARD_LINES[0];
export const ROCKY_EASY = EASY_LINES[0];
/** Fixed. Not a pool. */
export const ROCKY_FINISH = "That's how it's done. You showed up and won the work.";
/** One syllable on the first HARD chirp. Fixed. Never skipped. */
export const ROCKY_GO = 'Go.';
/** Once, when the last easy of a set opens the set rest. Fixed. */
export const ROCKY_ROUND = 'Round won. Stay sharp.';

export type LineTake = { line: string; clip: string };

/** Every fourth easy is quiet, shifted by the session. 25% — inside 20–30%. */
export function easySpeaks(ordinal: number, salt = 0): boolean {
  return (ordinal + salt) % 4 !== 3;
}

export function hardTake(ordinal: number, salt = 0): LineTake {
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

export type RockyCue = { key: string; line: string; clip: string };

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
      const take = hardTake(thisHard, salt);
      return { key: `hard:${seg.id}`, line: take.line, clip: take.clip };
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
