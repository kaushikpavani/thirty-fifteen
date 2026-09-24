export const colors = {
  bg: '#0A0E14',
  bgElevated: '#12181F',
  bgCard: '#161D27',
  bgSoft: '#1A2330',
  border: '#243041',
  borderSoft: '#1E2A38',

  text: '#F2F5F8',
  textMuted: '#8B9AAB',
  textDim: '#5C6B7A',

  teal: '#2DD4BF',
  tealDim: '#14B8A6',
  tealGlow: 'rgba(45, 212, 191, 0.18)',
  tealSoft: 'rgba(45, 212, 191, 0.08)',

  orange: '#FB923C',
  orangeHot: '#F97316',
  orangeGlow: 'rgba(251, 146, 60, 0.22)',
  orangeSoft: 'rgba(251, 146, 60, 0.10)',

  hard: '#FF5A3D',
  hardGlow: 'rgba(255, 90, 61, 0.25)',
  easy: '#2DD4BF',
  easyGlow: 'rgba(45, 212, 191, 0.18)',
  rest: '#7C8DB5',
  restGlow: 'rgba(124, 141, 181, 0.18)',
  warmup: '#FBBF24',
  warmupGlow: 'rgba(251, 191, 36, 0.18)',
  cooldown: '#60A5FA',
  cooldownGlow: 'rgba(96, 165, 250, 0.18)',
  done: '#34D399',

  danger: '#EF4444',
  success: '#34D399',
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

export function phaseColor(kind: PhaseKind): string {
  switch (kind) {
    case 'hard':
    case 'accel':
      return colors.hard;
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
      return colors.teal;
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
      return colors.tealGlow;
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
