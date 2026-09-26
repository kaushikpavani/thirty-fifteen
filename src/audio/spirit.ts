/** Same edges as the cue clock in rocky.ts. Local so this module has no runtime import. */
const CLOCK_HIT_MS = 400;
const WARN_BEFORE_MS = 3000;

export type MusicBed = 'drive' | 'driveB' | 'recover' | 'recoverB';
export type LadderStep = 'three' | 'two' | 'one';
export type BoundaryChirp = 'go' | 'win';

/** Drive is the hot bed. The B takes are the same family, a notch hotter or cooler. */
export const BED_VOLUME: Record<MusicBed, number> = {
  drive: 0.55,
  driveB: 0.62,
  recover: 0.22,
  recoverB: 0.18,
};

/** Bed goes to silence under Rocky and from T−3 through T+1. */
export const DUCK_GAIN = 0;
export const BEEP_DUCK_MS = 340;
/** The go chirp keeps the bed down through the first second of HARD. */
export const HARD_OPEN_DUCK_MS = 1000;
/** Win chirp plus the longer of the two set-break lines. */
export const ROUND_DUCK_MS = 4000;

const LADDER_AT_MS: Record<LadderStep, number> = {
  three: 3000,
  two: 2000,
  one: 1000,
};

/** HARD is hot. Accelerations stay on the drive bed. Everything else is cool. */
export function bedForKind(kind: string): MusicBed {
  return kind === 'hard' || kind === 'accel' ? 'drive' : 'recover';
}

/**
 * Stable offset for one ride. Same start always picks the same takes.
 * No Math.random — a different Start tap is a different session, not a dice roll mid-rep.
 */
export function varietySalt(startedAt: number | null | undefined): number {
  if (startedAt == null || !Number.isFinite(startedAt)) return 0;
  return Math.abs(Math.floor(startedAt / 1000)) % 12;
}

/** Alternate bed per set, still inside the hot or cool family. */
export function bedId(kind: string, setNumber: number | null | undefined, salt = 0): MusicBed {
  const set = setNumber != null && setNumber > 0 ? setNumber : 1;
  const alt = (set - 1 + salt) % 2 === 1;
  if (kind === 'hard' || kind === 'accel') return alt ? 'driveB' : 'drive';
  return alt ? 'recoverB' : 'recover';
}

/** Which rising-tick timbre this HARD approach uses. Slots stay on the clock. */
export function ladderTone(approach: number, salt = 0): 0 | 1 | 2 {
  const n = Math.abs(Math.floor(approach) + salt) % 3;
  return n as 0 | 1 | 2;
}

export function ladderBeep(step: LadderStep, tone: 0 | 1 | 2): string {
  const base = step === 'three' ? 'rung3' : step === 'two' ? 'rung2' : 'rung1';
  if (tone === 1) return `${base}b`;
  if (tone === 2) return `${base}c`;
  return base;
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
