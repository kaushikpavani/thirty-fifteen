import * as Speech from 'expo-speech';
import type { WorkoutSettings } from '../types';

const beepModules = {
  go: require('../../assets/beep-go.wav'),
  easy: require('../../assets/beep-easy.wav'),
  warn: require('../../assets/beep-warn.wav'),
  done: require('../../assets/beep-done.wav'),
} as const;

type BeepKind = keyof typeof beepModules;
type ExpoAudioModule = Pick<typeof import('expo-audio'), 'createAudioPlayer' | 'setAudioModeAsync'>;

let expoAudio: ExpoAudioModule | null | undefined;
let audioReady = false;
let beepsUnavailable = false;
let initPromise: Promise<void> | null = null;
const cache: Partial<Record<BeepKind, ReturnType<ExpoAudioModule['createAudioPlayer']>>> = {};

/**
 * Load expo-audio only when cues are needed so a missing native module cannot
 * crash the app during the initial bundle evaluation.
 */
function loadExpoAudio(): ExpoAudioModule | null {
  if (expoAudio !== undefined) return expoAudio;
  try {
    expoAudio = require('expo-audio') as ExpoAudioModule;
  } catch {
    expoAudio = null;
    beepsUnavailable = true;
  }
  return expoAudio;
}

function releasePlayers(): void {
  for (const key of Object.keys(cache) as BeepKind[]) {
    try {
      cache[key]?.remove();
    } catch {
      // ignore
    }
    delete cache[key];
  }
  audioReady = false;
}

async function preparePlayers(): Promise<void> {
  if (audioReady || beepsUnavailable) return;
  const audio = loadExpoAudio();
  if (!audio) return;
  try {
    await audio.setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
    for (const key of Object.keys(beepModules) as BeepKind[]) {
      const player = audio.createAudioPlayer(beepModules[key]);
      player.volume = 0.85;
      cache[key] = player;
    }
    audioReady = true;
  } catch {
    releasePlayers();
    beepsUnavailable = true;
  }
}

export function initAudio(): Promise<void> {
  if (audioReady || beepsUnavailable) return Promise.resolve();
  if (!initPromise) {
    initPromise = preparePlayers().finally(() => {
      initPromise = null;
    });
  }
  return initPromise;
}

export function speak(text: string, settings: WorkoutSettings): void {
  if (!settings.speechEnabled || !text.trim()) return;
  try {
    Speech.stop();
    Speech.speak(text, {
      language: 'en-US',
      rate: settings.voiceRate,
      pitch: 1.0,
    });
  } catch {
    // ignore
  }
}

export function stopSpeech(): void {
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}

export async function playBeep(settings: WorkoutSettings, kind: BeepKind = 'go'): Promise<void> {
  if (!settings.beepsEnabled || beepsUnavailable) return;
  try {
    if (!audioReady) await initAudio();
    const player = cache[kind];
    if (!player) return;
    await player.seekTo(0);
    player.play();
  } catch {
    // Beeps are optional. Spoken cues still run.
  }
}

export async function unloadAudio(): Promise<void> {
  stopSpeech();
  releasePlayers();
}
