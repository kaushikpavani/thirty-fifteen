/**
 * Phase paint for the ride.
 * The drive beds are 8.00s loops of 16 beats, so the HARD glow breathes at 120 BPM.
 * The countdown does not. Digit ticks and the T=0 punch stay on the clock.
 */

/** Beats per minute of `drive.wav` and `drive-b.wav`. */
export const DRIVE_BPM = 128;

/** Bike texture under the digits. The whole layer, not each speck. */
export const ROAD_WASH_OPACITY = 0.15;

/**
 * Home veil on `#070708`. Hotter than a cool pool, still behind the orange Start.
 */
export const HOME_HEAT = 0.2;

export type FieldPaint = { core: number; mid: number; edge: number };

/**
 * Full-field phase color. The edge stays painted so the screen reads as the phase.
 * Core stays under 0.7 so white digits remain the hero.
 */
export function fieldPaint(heat: 'hot' | 'cool'): FieldPaint {
  if (heat === 'cool') return { core: 0.4, mid: 0.22, edge: 0.12 };
  return { core: 0.62, mid: 0.38, edge: 0.22 };
}

/** One beat of the drive bed, after the session playback rate. */
export function driveBeatMs(rate = 1): number {
  const safe = Number.isFinite(rate) && rate > 0 ? rate : 1;
  return Math.round(60_000 / DRIVE_BPM / safe);
}

/**
 * Paint pulse. HARD and accelerations only, and only while the bed is on.
 * EASY, pause, music off, and Reduce Motion stay a still field.
 */
export function phasePulse(input: {
  kind: string;
  music: boolean;
  paused: boolean;
  reduceMotion: boolean;
  rate?: number;
}): { pulse: boolean; beatMs: number } {
  const drive = input.kind === 'hard' || input.kind === 'accel';
  return {
    pulse: drive && input.music && !input.paused && !input.reduceMotion,
    beatMs: driveBeatMs(input.rate),
  };
}

/** Horizontal blur under the clock. Fractions of the field. */
export const ROAD_STREAKS = [
  { y: 0.36, thickness: 0.01, tone: 0.34 },
  { y: 0.44, thickness: 0.028, tone: 0.16 },
  { y: 0.5, thickness: 0.006, tone: 0.48 },
  { y: 0.57, thickness: 0.018, tone: 0.2 },
  { y: 0.66, thickness: 0.008, tone: 0.3 },
] as const;

/** Asphalt specks. Stable for a ride. No Math.random, so the grain does not crawl. */
export function asphaltSpecks(count = 64): { x: number; y: number }[] {
  const total = Number.isFinite(count) ? Math.max(0, Math.min(160, Math.floor(count))) : 64;
  const out: { x: number; y: number }[] = [];
  let n = 17;
  for (let i = 0; i < total; i++) {
    n = (n * 1103515245 + 12345) % 2147483648;
    const x = (n % 1000) / 1000;
    n = (n * 1103515245 + 12345) % 2147483648;
    const y = (n % 1000) / 1000;
    out.push({ x, y });
  }
  return out;
}
