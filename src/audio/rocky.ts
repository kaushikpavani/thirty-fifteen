/** Spoken only. Never render these strings. */

export const SILENCE_AFTER_MS = 1000;
export const SILENCE_BEFORE_MS = 3000;

export const ROCKY_WELCOME = 'Thirty hard. Fifteen easy. Settle in.';
export const ROCKY_FINISH = 'That is the work. Easy spinning home.';

const HARD_LINES = ['Steady. You have this.', 'Stay with the number.', 'Smooth. This is the rep.'];
const EASY_LINES = ['Light now. Keep turning.', 'Easy breath. Stay on the pedals.'];

export type RockySegment = {
  id: string;
  kind: string;
  durationMs: number;
  repNumber?: number;
};

export type RockyCue = { key: string; line: string };

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
}): RockyCue | null {
  const { elapsedMs, segments, fired } = args;
  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const start = acc;
    const end = acc + seg.durationMs;
    acc = end;
    if (elapsedMs < start || elapsedMs >= end) continue;

    const elapsedIn = elapsedMs - start;
    if (inSegmentSilence(elapsedIn, seg.durationMs)) return null;

    if (elapsedMs > SILENCE_AFTER_MS && elapsedMs <= 1800 && !fired.has('welcome')) {
      return { key: 'welcome', line: ROCKY_WELCOME };
    }

    if (
      seg.kind === 'hard' &&
      elapsedIn >= 10_000 &&
      elapsedIn < 12_000 &&
      !fired.has(`hard:${seg.id}`)
    ) {
      const index = Math.max(0, (seg.repNumber ?? 1) - 1) % HARD_LINES.length;
      return { key: `hard:${seg.id}`, line: HARD_LINES[index] };
    }

    if (
      seg.kind === 'easy' &&
      elapsedIn > SILENCE_AFTER_MS &&
      elapsedIn <= 3000 &&
      !fired.has(`easy:${seg.id}`)
    ) {
      const index = Math.max(0, (seg.repNumber ?? 1) - 1) % EASY_LINES.length;
      return { key: `easy:${seg.id}`, line: EASY_LINES[index] };
    }

    const last = lastMainIndex(segments);
    if (last >= 0 && i === last + 1 && elapsedIn > SILENCE_AFTER_MS && elapsedIn <= 2200 && !fired.has('finish')) {
      return { key: 'finish', line: ROCKY_FINISH };
    }

    return null;
  }
  return null;
}
