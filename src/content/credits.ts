import { WELCOME_PHOTO, WHY_PHOTO } from './photos';

export type Credit = { title: string; detail: string; url?: string };

export function credits(): Credit[] {
  const out: Credit[] = [];
  for (const [title, photo] of [['Welcome photo', WELCOME_PHOTO], ['Why 30/15 photo', WHY_PHOTO]] as const) {
    if (photo?.credit) out.push({ title, detail: photo.credit, url: photo.url });
  }
  out.push({ title: 'Coach voices and music', detail: 'Made for 30/15 with ElevenLabs', url: 'https://elevenlabs.io' });
  out.push({ title: 'Sounds, icons and illustrations', detail: 'Original to 30/15' });
  out.push({
    title: 'Fitness comparison data',
    detail: 'FRIEND registry, Mayo Clinic Proceedings, 2022',
    url: 'https://doi.org/10.1016/j.mayocp.2021.08.020',
  });
  return out;
}
