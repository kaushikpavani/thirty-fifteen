import type { WorkoutSettings } from '../types';

export const DEFAULT_SETTINGS: WorkoutSettings = {
  ftpWatts: 125,
  hardPct: 120,
  easyPct: 50,
  warmupMin: 12,
  sets: 3,
  reps: 13,
  workSec: 30,
  recoverSec: 15,
  betweenSetRestMin: 4,
  cooldownMin: 10,
  speechEnabled: true,
  voiceRate: 1.05,
  cueLeadMs: 800,
  beepsEnabled: true,
  hapticsEnabled: true,
};

export const TIP =
  "Don't blast early reps; keep light pressure on 15s recoveries.";

export const SCIENCE_BLURB =
  'Rønnestad 30/15 micro-intervals maximize cumulative time near VO₂max with short recoveries that keep heart rate elevated. Great VO₂max stimulus — not a replacement for Zone 2 base work.';

export function derivedWatts(ftp: number, hardPct: number, easyPct: number) {
  return {
    hard: Math.round((ftp * hardPct) / 100),
    easy: Math.round((ftp * easyPct) / 100),
  };
}
