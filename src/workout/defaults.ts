import type { WorkoutSettings } from '../types';

export const DEFAULT_SETTINGS: WorkoutSettings = {
  ftpWatts: 120,
  hardPct: 120,
  easyPct: 50,
  warmupMin: 12,
  sets: 2,
  reps: 13,
  workSec: 30,
  recoverSec: 15,
  betweenSetRestMin: 4,
  cooldownMin: 10,
  speechEnabled: true,
  voiceRate: 1,
  cueLeadMs: 800,
  beepsEnabled: true,
  hapticsEnabled: true,
  musicEnabled: true,
  coachVoice: 'direct',
  spokenCount: true,
  ageYears: null,
  sex: null,
  weightLb: null,
  restingHr: null,
  ftpSetByRider: false,
  profilePromptSeen: false,
};

export const SCIENCE_BLURB =
  'Rønnestad 30/15 micro-intervals maximize cumulative time near VO₂max with short recoveries that keep heart rate elevated. Great VO₂max stimulus — not a replacement for Zone 2 base work.';

export function derivedWatts(ftp: number, hardPct: number, easyPct: number) {
  return {
    hard: Math.round((ftp * hardPct) / 100),
    easy: Math.round((ftp * easyPct) / 100),
  };
}
