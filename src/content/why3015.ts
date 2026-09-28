/** Plain explanation of the 30/15 format. Shown only when the rider asks. */

export const WHY_TITLE = 'Why 30/15';

export const WHY_SECTIONS = [
  {
    title: 'More time where it counts',
    body: 'Fifteen seconds is too short for your oxygen uptake to fall. You stack up more minutes near VO₂max than you could hold in one long effort.',
  },
  {
    title: 'Backed by research',
    body: 'Trained cyclists doing 30/15 improved more than riders doing effort-matched 5-minute intervals.',
    cite: 'Rønnestad et al., 2015',
  },
  {
    title: 'A sharpener, not a base',
    body: 'Once or twice a week. Keep your easy Zone 2 rides around it.',
  },
  {
    title: 'How it should feel',
    body: 'The first reps feel easy. The last three feel like a 9 out of 10. Easy means easy: keep the legs turning.',
  },
  {
    title: 'Your targets',
    body: 'HARD and EASY come from your FTP (default 120 W → 144 / 60 W). Change it any time in Settings. No account is required to ride.',
  },
] as const;

export const WHY_FOOTNOTE = 'A coaching timer, not a medical device. Ride within your limits.';

export function whyCopyBlob(): string {
  return [WHY_TITLE, ...WHY_SECTIONS.flatMap((s) => [s.title, s.body, 'cite' in s ? s.cite : '']), WHY_FOOTNOTE].join('\n');
}
