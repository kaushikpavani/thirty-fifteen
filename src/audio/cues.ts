import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import type { WorkoutSettings } from '../types';

const beepModules = {
  go: require('../../assets/beep-go.wav'),
  easy: require('../../assets/beep-easy.wav'),
  warn: require('../../assets/beep-warn.wav'),
  done: require('../../assets/beep-done.wav'),
} as const;

let audioReady = false;
const cache: Partial<Record<keyof typeof beepModules, Audio.Sound>> = {};

export async function initAudio(): Promise<void> {
  if (audioReady) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    for (const key of Object.keys(beepModules) as (keyof typeof beepModules)[]) {
      const { sound } = await Audio.Sound.createAsync(beepModules[key], {
        shouldPlay: false,
        volume: 0.85,
      });
      cache[key] = sound;
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

export async function playBeep(
  settings: WorkoutSettings,
  kind: keyof typeof beepModules = 'go',
): Promise<void> {
  if (!settings.beepsEnabled) return;
  try {
    if (!audioReady) await initAudio();
    const sound = cache[kind];
    if (sound) {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    }
  } catch {
    // ignore beep failures
  }
}

export async function unloadAudio(): Promise<void> {
  stopSpeech();
  for (const key of Object.keys(cache) as (keyof typeof cache)[]) {
    try {
      await cache[key]?.unloadAsync();
    } catch {
      // ignore
    }
    delete cache[key];
  }
  audioReady = false;
}
