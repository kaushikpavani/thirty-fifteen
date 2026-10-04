/**
 * Coach voices. Each language has a female and a male coach who speak the
 * same clips, so cue timing never depends on who is talking. The words live
 * in assets/voice/script.<lang>.json; scripts/gen-voice-elevenlabs.mjs turns
 * them into audio and into the generated coachLines.ts imported here.
 * Spoken only; never render these strings.
 */
import type { CoachVoice, WorkoutSettings } from '../types';
import { COACH_LANGUAGES, COACH_LINES } from './coachLines';

export type RecordedVoice = Exclude<CoachVoice, 'off'>;

export const DEFAULT_LANGUAGE = 'en';
export const DEFAULT_COACH: RecordedVoice = 'female';

/** A stored language the app no longer (or doesn't yet) ship falls back to English. */
export function coachLanguage(settings: Pick<WorkoutSettings, 'coachLanguage'>): string {
  return COACH_LINES[settings.coachLanguage] ? settings.coachLanguage : DEFAULT_LANGUAGE;
}

/** Older installs stored 'direct', 'calm' or 'numbers'. Anything that isn't a current coach becomes the default. */
export function normalizeCoach(value: unknown): CoachVoice {
  return value === 'female' || value === 'male' || value === 'off' ? value : DEFAULT_COACH;
}

export function languageName(language: string): string {
  return COACH_LANGUAGES.find((entry) => entry.id === language)?.name ?? 'English';
}

export function voiceName(voice: CoachVoice, language = DEFAULT_LANGUAGE): string {
  if (voice === 'off') return 'Off';
  const name = COACH_LANGUAGES.find((entry) => entry.id === language)?.coaches[voice];
  return name ?? (voice === 'male' ? 'Male coach' : 'Female coach');
}

type Lengths = Pick<WorkoutSettings, 'warmupMin' | 'betweenSetRestMin' | 'cooldownMin'>;

const whole = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

/**
 * Three cues say how long the next part lasts, so their clip depends on the
 * rider's settings: the warm-up, the rest between sets, and the cool-down.
 */
export function clipFor(clip: string, lengths: Lengths): string {
  if (clip === 'welcome') return `warmup${whole(lengths.warmupMin, 5, 30)}`;
  if (clip === 'round0') return `rest${whole(lengths.betweenSetRestMin, 1, 10)}`;
  if (clip === 'finish0') return `cooldown${whole(lengths.cooldownMin, 3, 20)}`;
  return clip;
}

const LENGTH_CLIP = /^(warmup|rest|cooldown)\d+$/;

/** The clips one ride can use: everything fixed, plus the three length lines for these settings. */
export function clipsForRide(all: readonly string[], lengths: Lengths): string[] {
  const mine = new Set([clipFor('welcome', lengths), clipFor('round0', lengths), clipFor('finish0', lengths)]);
  return all.filter((clip) => !LENGTH_CLIP.test(clip) || mine.has(clip));
}

/**
 * Which recorded clip and fallback text a cue plays, or null for silence.
 * The words come from the script for the rider's language; a cue the script
 * doesn't know keeps the line it was given.
 */
export function resolveClip(
  cue: { key: string; clip?: string; line: string },
  settings: Lengths & Pick<WorkoutSettings, 'coachLanguage'>,
): { clip: string; line: string } | null {
  const clip = cue.clip ? clipFor(cue.clip, settings) : '';
  const line = clip ? COACH_LINES[coachLanguage(settings)]?.[clip] : undefined;
  if (line) return { clip, line };
  return cue.line.trim() ? { clip: '', line: cue.line } : null;
}

/** Rotate through a clip's takes so the same recording never plays twice in a row. */
export function nextTake(count: number, last: number | undefined): number {
  if (count <= 1) return 0;
  return ((last ?? -1) + 1) % count;
}
