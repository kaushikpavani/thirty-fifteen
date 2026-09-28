/** Pure gauge maths, shared by the ride gauge and its tests. */

/** Inside this share of target counts as on target (±3%). */
export const ON_TARGET = 0.97;

export type GaugeState = 'none' | 'free' | 'under' | 'on';

/** Pure: how the gauge reads a watt value against a target. */
export function gaugeRead(watts: number | null, target: number | null): { state: GaugeState; max: number; frac: number; targetFrac: number | null } {
  const max = target ? Math.max(target * 1.6, 1) : 400;
  if (watts == null) return { state: 'none', max, frac: 0, targetFrac: target ? target / max : null };
  const frac = Math.max(0, Math.min(1, watts / max));
  if (!target) return { state: 'free', max, frac, targetFrac: null };
  return { state: watts >= target * ON_TARGET ? 'on' : 'under', max, frac, targetFrac: target / max };
}

