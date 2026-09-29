/** Same edges as the cue clock in rocky.ts. Local so this module has no runtime import. */
const CLOCK_HIT_MS = 400;
const WARN_BEFORE_MS = 3000;

export type MusicBed = 'drive' | 'driveB' | 'recover' | 'recoverB' | 'ambient';
export type LadderStep = 'three' | 'two' | 'one';
export type BoundaryChirp = 'go' | 'win' | 'release';

/**
 * Pulse, the built-in score: 128 BPM, so a 30 s HARD is exactly 16 bars and a
 * 15 s EASY exactly 8. Drive is HARD, recover is EASY, ambient carries warm-up,
 * set rest and cool-down. The B takes are the same family in another key.
 */
export const PULSE_BPM = 128;
export const BED_VOLUME: Record<MusicBed, number> = {
  drive: 0.6,
  driveB: 0.62,
  recover: 0.42,
  recoverB: 0.4,
  ambient: 0.34,
};

/** The bed dips 12 dB under the coach and the ticks. It never drops to silence. */
export const DUCK_GAIN = 0.25;
export const BEEP_DUCK_MS = 340;
/** The go chirp only clears its own attack, so the drop lands on Go at full level. */
export const HARD_OPEN_DUCK_MS = 250;
/** Win chirp plus the longer of the two set-break lines. */
export const ROUND_DUCK_MS = 4000;

const LADDER_AT_MS: Record<LadderStep, number> = {
  three: 3000,
  two: 2000,
  one: 1000,
};

/** HARD and accelerations drive. EASY recovers. Warm-up, set rest and cool-down float. */
export function bedForKind(kind: string): MusicBed {
  if (kind === 'hard' || kind === 'accel') return 'drive';
  if (kind === 'easy') return 'recover';
  return 'ambient';
}

/**
 * Stable offset for one ride. Same start always picks the same takes.
 * No Math.random — a different Start tap is a different session, not a dice roll mid-rep.
 */
export function varietySalt(startedAt: number | null | undefined): number {
  if (startedAt == null || !Number.isFinite(startedAt)) return 0;
  return Math.abs(Math.floor(startedAt / 1000)) % 12;
}

/** One bed family for the whole ride, chosen at Start. 0 and 1 are different loops. 2 is the drive loop, brighter. */
export function sessionBed(salt = 0): 0 | 1 | 2 {
  const n = Math.abs(Math.floor(salt)) % 3;
  return n as 0 | 1 | 2;
}

export function bedId(kind: string, salt = 0): MusicBed {
  const base = bedForKind(kind);
  if (base === 'ambient' || sessionBed(salt) !== 1) return base;
  return base === 'drive' ? 'driveB' : 'recoverB';
}

/** Always 1: a faster bed would drift off the 16-bar phrase and miss Go. */
export function bedRate(_kind: string, _salt = 0): number {
  return 1;
}

export type LadderTexture = 'pitch' | 'volume' | 'strongThird';

/** First HARD always counts in. After that, every fifth approach keeps a single warn. */
export function ladderSkipped(approach: number): boolean {
  return approach > 0 && approach % 5 === 0;
}

/** Texture for this approach. The 3 / 2 / 1 slots do not move. */
export function ladderTexture(approach: number, salt = 0): LadderTexture {
  const pool = ['pitch', 'volume', 'strongThird'] as const;
  return pool[Math.abs(Math.floor(approach) + salt) % pool.length];
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
 * Rising ticks on the segment that leads into a HARD or an EASY, so the rider
 * always hears "three, two, one" before either flip — the phone is often in a
 * pocket with no screen to watch. Only when that segment is long enough for a T−3.
 */
export function ladderArmed(durationMs: number, nextKind: string | null | undefined): boolean {
  return (nextKind === 'hard' || nextKind === 'easy') && durationMs > WARN_BEFORE_MS + CLOCK_HIT_MS;
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
  if (kind === 'easy') return 'release';
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
