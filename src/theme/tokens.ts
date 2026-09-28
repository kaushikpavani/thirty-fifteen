/**
 * Carbon & Ember — the 30/15 design system.
 *
 * True black, one hot color, one cool color. The ride is the only place
 * color floods the screen, and there it tells the time.
 * Mirrors docs/ux/tokens.md. Hierarchy matters more than any single hex.
 */
import { Platform, type TextStyle } from 'react-native';
import type { PhaseKind } from '../types';

export const ink = {
  ground: '#000000',
  surface: '#111113',
  grouped: '#1C1C1E',
  raised: '#2C2C2E',
  hairline: 'rgba(255,255,255,0.08)',
  text: '#F5F5F2',
  secondary: '#9B9BA1',
  tertiary: '#7A7A80',
  faint: '#5A5A5F',
  /** Brand + Start + HARD accents. Black label on top, never white. */
  ember: '#FF5A1F',
  emberText: '#FF6A2B',
  emberSoft: 'rgba(255,90,31,0.16)',
  glacier: '#5CC8E6',
  rose: '#FF375F',
  roseSoft: 'rgba(255,55,95,0.16)',
  signal: '#32D74B',
  danger: '#FF7B6B',
} as const;

/** Full-bleed ride fields. White text passes on every one. */
export type Field = {
  base: string;
  /** Warm or cool light that rises from the bottom edge. */
  glow: string;
  /** Shade that falls from the top as the segment runs out. */
  shade: string;
  label: string;
};

export const fields: Record<'hard' | 'easy' | 'warmup' | 'rest' | 'cooldown' | 'paused', Field> = {
  hard: { base: '#E0410F', glow: 'rgba(255,176,92,0.55)', shade: 'rgba(58,6,0,0.38)', label: 'HARD' },
  easy: { base: '#0B5569', glow: 'rgba(120,226,245,0.40)', shade: 'rgba(0,14,24,0.40)', label: 'EASY' },
  warmup: { base: '#1B2330', glow: 'rgba(255,150,70,0.34)', shade: 'rgba(0,0,0,0.32)', label: 'WARM-UP' },
  rest: { base: '#141A33', glow: 'rgba(92,200,230,0.26)', shade: 'rgba(0,0,0,0.30)', label: 'SET REST' },
  cooldown: { base: '#141A33', glow: 'rgba(92,200,230,0.22)', shade: 'rgba(0,0,0,0.30)', label: 'COOL-DOWN' },
  paused: { base: '#2A120A', glow: 'rgba(224,65,15,0.40)', shade: 'rgba(0,0,0,0)', label: 'PAUSED' },
};

export function fieldFor(kind: PhaseKind): Field {
  switch (kind) {
    case 'hard':
    case 'accel':
      return fields.hard;
    case 'easy':
      return fields.easy;
    case 'set_rest':
      return fields.rest;
    case 'cooldown':
    case 'done':
      return fields.cooldown;
    default:
      return fields.warmup;
  }
}

export const radius = { card: 28, tile: 24, group: 22, row: 20, pill: 32 } as const;

const display = Platform.select({ ios: 'System', default: undefined });

const num: TextStyle = { fontFamily: display, fontVariant: ['tabular-nums'] };

/** Type scale. Ride digits are fixed so they stay glanceable on the bars. */
export const type = {
  watts: { ...num, fontSize: 150, lineHeight: 150, fontWeight: '600', letterSpacing: -4 } as TextStyle,
  wattsUnit: { fontSize: 30, fontWeight: '700' } as TextStyle,
  countdown: { ...num, fontSize: 88, lineHeight: 94, fontWeight: '500', letterSpacing: -3 } as TextStyle,
  countIn: { ...num, fontSize: 124, lineHeight: 128, fontWeight: '600', letterSpacing: -3 } as TextStyle,
  bpm: { ...num, fontSize: 50, lineHeight: 54, fontWeight: '500', letterSpacing: -1.5 } as TextStyle,
  phase: { fontSize: 17, fontWeight: '800', letterSpacing: 3 } as TextStyle,
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.6 } as TextStyle,
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 } as TextStyle,
  metric: { ...num, fontSize: 28, fontWeight: '600', letterSpacing: -0.6 } as TextStyle,
  headline: { fontSize: 17, fontWeight: '600' } as TextStyle,
  body: { fontSize: 17, lineHeight: 22 } as TextStyle,
  callout: { fontSize: 15, lineHeight: 21 } as TextStyle,
  caption: { fontSize: 13, lineHeight: 18 } as TextStyle,
  section: { fontSize: 13, fontWeight: '500', letterSpacing: 0.4 } as TextStyle,
  tabular: num,
} as const;

/** Motion. Everything short and soft; Reduce Motion cuts instead. */
export const motion = {
  phaseMs: 300,
  pressScale: 0.96,
  holdToEndMs: 1200,
} as const;
