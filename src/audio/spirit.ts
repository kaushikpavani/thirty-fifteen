/** Same edges as the cue clock in rocky.ts. Local so this module has no runtime import. */
const CLOCK_HIT_MS = 400;
const WARN_BEFORE_MS = 3000;

export type MusicBed = 'drive' | 'recover';
export type CountWord = 'three' | 'two' | 'one';

/** Drive sits forward. Recover is the same ride, turned down and darker in the file. */
export const BED_VOLUME: Record<MusicBed, number> = {
  drive: 0.5,
  recover: 0.28,
};

/** Hard duck. Speech and beeps stay in front of the bed. */
export const DUCK_GAIN = 0.08;
export const BEEP_DUCK_MS = 340;
export const COUNT_DUCK_MS = 640;

const COUNT_AT_MS: Record<CountWord, number> = {
  three: 3000,
  two: 2000,
  one: 1000,
};

/** HARD and the warm-up accelerations. Everything else, including the spin before the first HARD, is recover. */
export function bedForKind(kind: string): MusicBed {
  return kind === 'hard' || kind === 'accel' ? 'drive' : 'recover';
}

/**
 * Spoken 3-2-1 only when the next phase is HARD and the segment is long enough
 * for the existing T−3 warn. Each word uses the same 400ms window as the clock.
 */
export function countdownArmed(durationMs: number, nextKind: string | null | undefined): boolean {
  return nextKind === 'hard' && durationMs > WARN_BEFORE_MS + CLOCK_HIT_MS;
}

export function countdownWord(
  elapsedInMs: number,
  durationMs: number,
  nextKind: string | null | undefined,
): CountWord | null {
  if (!countdownArmed(durationMs, nextKind)) return null;
  const remaining = durationMs - elapsedInMs;
  for (const word of ['three', 'two', 'one'] as const) {
    const at = COUNT_AT_MS[word];
    if (remaining <= at && remaining > at - CLOCK_HIT_MS) return word;
  }
  return null;
}

/** The spoken "three" replaces the T−3 beep on the way into HARD. The flip chirp stays. */
export function warnYieldsToCountdown(nextKind: string | null | undefined, speechEnabled: boolean): boolean {
  return speechEnabled && nextKind === 'hard';
}

export function countKeys(segmentId: string): string[] {
  return ['three', 'two', 'one'].map((word) => `count:${segmentId}:${word}`);
}

export function roundWon(previousKind: string | null | undefined, kind: string | null | undefined): boolean {
  return previousKind === 'hard' && kind === 'easy';
}

export function rockyDuckMs(key: string): number {
  if (key === 'welcome') return 2400;
  if (key === 'finish') return 3200;
  if (key.startsWith('hard:')) return 3100;
  if (key.startsWith('easy:')) return 3200;
  return 2600;
}
