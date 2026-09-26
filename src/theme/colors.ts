export const colors = {
  bg: '#070708',
  bgElevated: '#101012',
  bgCard: '#141416',
  bgSoft: '#1C1C1E',
  border: 'rgba(255,255,255,0.10)',
  borderSoft: 'rgba(255,255,255,0.06)',

  text: '#F5F5F7',
  textMuted: '#8E8E93',
  textDim: '#636366',

  hard: '#FF453A',
  hardGlow: 'rgba(255, 69, 58, 0.16)',
  easy: '#64D2FF',
  easyGlow: 'rgba(100, 210, 255, 0.12)',
  rest: '#8E8E93',
  restGlow: 'rgba(142, 142, 147, 0.12)',
  warmup: '#FFD60A',
  warmupGlow: 'rgba(255, 214, 10, 0.10)',
  cooldown: '#0A84FF',
  cooldownGlow: 'rgba(10, 132, 255, 0.14)',
  done: '#30D158',

  danger: '#FF453A',
  /** Saturated go. Primary actions use this, never white. */
  go: '#FF7A1A',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type PhaseKind =
  | 'warmup'
  | 'accel'
  | 'hard'
  | 'easy'
  | 'set_rest'
  | 'cooldown'
  | 'done';

/** Warm reds. A set steps the hue, never out of the hot family. */
export const HARD_FAMILY = ['#FF453A', '#FF5A38', '#FF3E32'] as const;
const HARD_GAIN = [1, 0.94, 1.06] as const;

function familyIndex(setNumber: number, salt: number): number {
  const set = Number.isFinite(setNumber) && setNumber > 0 ? setNumber : 1;
  return (set - 1 + salt) % HARD_FAMILY.length;
}

export function phaseColor(kind: PhaseKind, setNumber = 1, salt = 0): string {
  switch (kind) {
    case 'hard':
    case 'accel':
      return HARD_FAMILY[familyIndex(setNumber, salt)];
    case 'easy':
      return colors.easy;
    case 'set_rest':
      return colors.rest;
    case 'warmup':
      return colors.warmup;
    case 'cooldown':
      return colors.cooldown;
    case 'done':
      return colors.done;
    default:
      return colors.text;
  }
}

/** Slight intensity nudge for HARD. Easy and rest stay put. */
export function phaseIntensity(kind: PhaseKind, setNumber = 1, salt = 0): number {
  if (kind === 'hard' || kind === 'accel') return HARD_GAIN[familyIndex(setNumber, salt)];
  return 1;
}

export function phaseGlow(kind: PhaseKind): string {
  switch (kind) {
    case 'hard':
    case 'accel':
      return colors.hardGlow;
    case 'easy':
      return colors.easyGlow;
    case 'set_rest':
      return colors.restGlow;
    case 'warmup':
      return colors.warmupGlow;
    case 'cooldown':
      return colors.cooldownGlow;
    default:
      return 'rgba(255,255,255,0.04)';
  }
}

export function phaseLabel(kind: PhaseKind): string {
  switch (kind) {
    case 'warmup':
      return 'WARM-UP';
    case 'accel':
      return 'ACCEL';
    case 'hard':
      return 'HARD';
    case 'easy':
      return 'EASY';
    case 'set_rest':
      return 'REST';
    case 'cooldown':
      return 'COOL-DOWN';
    case 'done':
      return 'DONE';
    default:
      return '';
  }
}
