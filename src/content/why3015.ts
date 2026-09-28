/** Plain explanation of the 30/15 format. Shown only when the rider asks. */

export const WHY_HERO =
  'Short hard, short easy — so you can stay in the work that grows your engine. That’s why 30/15: more real time near your limit, not a longer slog that fades.';

export const WHY_BULLETS = [
  '30s hard / 15s easy is a researched cycling short-interval format (Rønnestad-style).',
  'Short recoveries help you pile up work near your aerobic ceiling — time near VO₂max matters for fitness.',
  'HARD / EASY targets come from your FTP (default 120 W → ~144 / ~60 W); edit FTP anytime.',
  'Offline coach: clock + cues; no account required to ride.',
  'Not a medical device — plain intervals for riders who want to get better.',
] as const;

export const WHY_COMPARE_TITLE = 'Same clock, different work';

export const WHY_COMPARE = [
  'Forty minutes of steady moderate riding keeps you comfortable but rarely near your aerobic ceiling. The same forty minutes as 30/15 (hard / easy) flips you between short hard efforts and short recoveries — so more of the session is spent near the intensity that challenges VO₂max, without needing a longer all-out slog.',
  'You still earn the ride either way. 30/15 just packs more of that high-end work into the same time — a training tool, not a medical promise.',
] as const;

export function whyCopyBlob(): string {
  return [WHY_HERO, ...WHY_BULLETS, WHY_COMPARE_TITLE, ...WHY_COMPARE].join('\n');
}
