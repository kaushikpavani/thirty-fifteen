import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import type { WorkoutSettings } from '../types';

const beepModules = {
  go: require('../../assets/beep-go.wav'),
  easy: require('../../assets/beep-easy.wav'),
  warn: require('../../assets/beep-warn.wav'),
  done: require('../../assets/beep-done.wav'),
} as const;

type BeepKind = keyof typeof beepModules;

let audioReady = false;
const cache: Partial<Record<BeepKind, AudioPlayer>> = {};

export async function initAudio(): Promise<void> {
  if (audioReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
    for (const key of Object.keys(beepModules) as BeepKind[]) {
      const player = createAudioPlayer(beepModules[key]);
      player.volume = 0.85;
      cache[key] = player;
    }
    audioReady = true;
  } catch {
    audioReady = false;
  }
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
  if (!settings.beepsEnabled) return;
  try {
    if (!audioReady) await initAudio();
    const player = cache[kind];
    if (!player) return;
    await player.seekTo(0);
    player.play();
  } catch {
    // ignore beep failures
  }
}

export async function unloadAudio(): Promise<void> {
  stopSpeech();
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
