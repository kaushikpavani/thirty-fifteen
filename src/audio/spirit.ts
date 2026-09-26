/** Same edges as the cue clock in rocky.ts. Local so this module has no runtime import. */
const CLOCK_HIT_MS = 400;
const WARN_BEFORE_MS = 3000;

export type MusicBed = 'drive' | 'recover';
export type LadderStep = 'three' | 'two' | 'one';
export type BoundaryChirp = 'go' | 'win';

/** Drive is the hot bed. Recover is the cool one. */
export const BED_VOLUME: Record<MusicBed, number> = {
  drive: 0.55,
  recover: 0.22,
};

/** Bed goes to silence under Rocky and from T−3 through T+1. */
export const DUCK_GAIN = 0;
export const BEEP_DUCK_MS = 340;
/** The go chirp keeps the bed down through the first second of HARD. */
export const HARD_OPEN_DUCK_MS = 1000;
/** Win chirp plus the one set-break line. */
export const ROUND_DUCK_MS = 2400;

const LADDER_AT_MS: Record<LadderStep, number> = {
  three: 3000,
  two: 2000,
  one: 1000,
};

/** HARD is hot. Accelerations stay on the drive bed. Everything else is cool. */
export function bedForKind(kind: string): MusicBed {
  return kind === 'hard' || kind === 'accel' ? 'drive' : 'recover';
}

/** From this rung through one second after the flip into HARD. */
export function ladderDuckMs(step: LadderStep): number {
  return LADDER_AT_MS[step] + HARD_OPEN_DUCK_MS;
}

/**
 * Rising ticks only on the segment that leads into a HARD, and only when that
 * segment is long enough for a T−3. No ladder into EASY.
 */
export function ladderArmed(durationMs: number, nextKind: string | null | undefined): boolean {
  return nextKind === 'hard' && durationMs > WARN_BEFORE_MS + CLOCK_HIT_MS;
}

export function ladderStep(
  elapsedInMs: number,
  durationMs: number,
  nextKind: string | null | undefined,
): LadderStep | null {
  if (!ladderArmed(durationMs, nextKind)) return null;
  const remaining = durationMs - elapsedInMs;
  for (const step of ['three', 'two', 'one'] as const) {
    const at = LADDER_AT_MS[step];
    if (remaining <= at && remaining > at - CLOCK_HIT_MS) return step;
  }
  return null;
}

export function ladderKeys(segmentId: string): string[] {
  return (['three', 'two', 'one'] as const).map((step) => `ladder:${segmentId}:${step}`);
}

/**
 * Phase-start beep.
 * EASY is silent. Cool-down waits for the heavier beep under the finish line.
 * Set rest gets the single win chirp.
 */
export function boundaryChirp(kind: string): BoundaryChirp | null {
  if (kind === 'hard' || kind === 'accel' || kind === 'warmup') return 'go';
  if (kind === 'set_rest') return 'win';
  return null;
}

export function isFirstHard(index: number, segments: { kind: string }[]): boolean {
  if (index < 0 || segments[index]?.kind !== 'hard') return false;
  return segments.findIndex((segment) => segment.kind === 'hard') === index;
}

/** Last EASY of a set opening the set rest. Not every easy, and not the cool-down. */
export function roundWon(previousKind: string | null | undefined, kind: string | null | undefined): boolean {
  return previousKind === 'easy' && kind === 'set_rest';
}

export function rockyDuckMs(key: string): number {
  if (key === 'welcome') return 2400;
  if (key === 'go') return HARD_OPEN_DUCK_MS;
  if (key === 'round' || key.startsWith('round:')) return ROUND_DUCK_MS;
  if (key === 'finish') return 3200;
  if (key.startsWith('hard:')) return 3100;
  if (key.startsWith('easy:')) return 3200;
  return 2600;
}
