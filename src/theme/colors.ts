export const colors = {
  bg: '#000000',
  bgElevated: '#111113',
  bgCard: '#111113',
  bgSoft: '#1C1C1E',
  border: 'rgba(255,255,255,0.10)',
  borderSoft: 'rgba(255,255,255,0.06)',

  text: '#F5F5F2',
  textMuted: '#9B9BA1',
  textDim: '#7A7A80',

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
  go: '#FF5A1F',
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

/**
 * Around #FF453A. Hue stays within ±8° and saturation within −6%.
 * Adjacent HARDs step the index, so the glow does not repeat immediately.
 */
export const HARD_FAMILY = ['#FF453A', '#FF5F3A', '#FF3A49', '#F94A40'] as const;

function familyIndex(hardOrdinal: number, salt: number): number {
  const ord = Number.isFinite(hardOrdinal) && hardOrdinal > 0 ? Math.floor(hardOrdinal) : 0;
  return (ord + salt) % HARD_FAMILY.length;
}

export function phaseColor(kind: PhaseKind, hardOrdinal = 0, salt = 0): string {
  switch (kind) {
    case 'hard':
    case 'accel':
      return HARD_FAMILY[familyIndex(hardOrdinal, salt)];
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
