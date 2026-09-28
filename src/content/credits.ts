import { WELCOME_PHOTO, WHY_PHOTO } from './photos';

export type Credit = { title: string; detail: string; url?: string };

export function credits(): Credit[] {
  const out: Credit[] = [];
  if (WELCOME_PHOTO) out.push({ title: 'Welcome photo', detail: WELCOME_PHOTO.credit, url: WELCOME_PHOTO.url });
  if (WHY_PHOTO) out.push({ title: 'Why 30/15 photo', detail: WHY_PHOTO.credit, url: WHY_PHOTO.url });
  out.push({ title: 'Coach voices', detail: 'Kokoro TTS, Apache License 2.0', url: 'https://github.com/hexgrad/kokoro' });
  out.push({ title: 'Pulse music, sounds, bike illustration', detail: 'Original to 30/15' });
  return out;
}
