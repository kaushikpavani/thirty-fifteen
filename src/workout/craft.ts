/** Home and finish glass. Which line shows. The clock does not move. */

export const HOME_TIPS = [
  'Light pressure on the fifteens. Stay turning.',
  'The hard is the work. The fifteen is the breath.',
  'Stay seated. Let the clock run.',
] as const;

export const FINISH_TITLES = ['Done.', "That's the work.", 'You showed up.'] as const;

/** About one open in four has no tip. The Start button is always there. */
export function homeTip(openedAt: number): string | null {
  if (!Number.isFinite(openedAt)) return HOME_TIPS[0];
  const slot = Math.abs(Math.floor(openedAt / 1000)) % 4;
  if (slot === 3) return null;
  return HOME_TIPS[slot] ?? HOME_TIPS[0];
}

export function finishTitle(salt: number): string {
  return FINISH_TITLES[Math.abs(Math.floor(salt)) % FINISH_TITLES.length];
}

export type FinishBloom = { ms: number; pulses: 1 | 2; warm: boolean };

/** Once per session: a short hard bloom, a longer warm one, or a double pulse. Then still. */
export function finishBloom(salt: number): FinishBloom {
  const slot = Math.abs(Math.floor(salt)) % 3;
  if (slot === 1) return { ms: 480, pulses: 1, warm: true };
  if (slot === 2) return { ms: 320, pulses: 2, warm: false };
  return { ms: 320, pulses: 1, warm: false };
}
