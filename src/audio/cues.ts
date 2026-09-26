import * as Speech from 'expo-speech';
import type { WorkoutSettings } from '../types';
import { attachMusicPlayers, duckMusic, releaseMusicPlayers } from './music';
import { BEEP_DUCK_MS, rockyDuckMs } from './spirit';

const beepModules = {
  go: require('../../assets/beep-go.wav'),
  easy: require('../../assets/beep-easy.wav'),
  warn: require('../../assets/beep-warn.wav'),
  done: require('../../assets/beep-done.wav'),
  rung3: require('../../assets/beep-rung-3.wav'),
  rung2: require('../../assets/beep-rung-2.wav'),
  rung1: require('../../assets/beep-rung-1.wav'),
  win: require('../../assets/beep-win.wav'),
  doneHeavy: require('../../assets/beep-done-heavy.wav'),
} as const;

const rockyModules = {
  welcome: require('../../assets/rocky/welcome.mp3'),
  hard: require('../../assets/rocky/hard.mp3'),
  easy: require('../../assets/rocky/easy.mp3'),
  finish: require('../../assets/rocky/finish.mp3'),
  go: require('../../assets/rocky/go.mp3'),
  round: require('../../assets/rocky/round.mp3'),
} as const;

type BeepKind = keyof typeof beepModules;
type RockyKind = keyof typeof rockyModules;
type ExpoAudioModule = Pick<typeof import('expo-audio'), 'createAudioPlayer' | 'setAudioModeAsync'>;
type Player = ReturnType<ExpoAudioModule['createAudioPlayer']>;

let expoAudio: ExpoAudioModule | null | undefined;
let audioReady = false;
let beepsUnavailable = false;
let rockyReady = false;
let boundaryHoldUntil = 0;
let initPromise: Promise<void> | null = null;
let voicePromise: Promise<void> | null = null;
let voiceResolved = false;
let voiceId: string | undefined;
let rockyToken = 0;
const cache: Partial<Record<BeepKind, Player>> = {};
const rockyCache: Partial<Record<RockyKind, Player>> = {};

const NOVELTY =
  /eloquence|bad news|bahh|bells|boing|bubbles|cellos|zarvox|trinoids|whisper|organ|superstar|jester|\bflo\b|grandma|grandpa|junior|kathy|ralph|albert/i;

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
  for (const key of Object.keys(rockyCache) as RockyKind[]) {
    try {
      rockyCache[key]?.remove();
    } catch {
      // ignore
    }
    delete rockyCache[key];
  }
  releaseMusicPlayers();
  audioReady = false;
  rockyReady = false;
  boundaryHoldUntil = 0;
}

function rockyKind(key: string): RockyKind | null {
  if (key === 'welcome') return 'welcome';
  if (key === 'finish') return 'finish';
  if (key === 'go') return 'go';
  if (key === 'round' || key.startsWith('round:')) return 'round';
  if (key.startsWith('hard:')) return 'hard';
  if (key.startsWith('easy:')) return 'easy';
  return null;
}

function holdBoundary(ms: number): void {
  boundaryHoldUntil = Math.max(boundaryHoldUntil, Date.now() + ms);
}

function scoreVoice(voice: Speech.Voice): number {
  const language = (voice.language || '').toLowerCase();
  if (!language.startsWith('en')) return -1;
  const id = `${voice.identifier} ${voice.name}`.toLowerCase();
  if (NOVELTY.test(id)) return -1;
  let score = language.startsWith('en-us') ? 8 : language.startsWith('en-gb') || language.startsWith('en-au') ? 4 : 1;
  if (voice.quality === Speech.VoiceQuality.Enhanced) score += 24;
  if (id.includes('premium')) score += 40;
  if (id.includes('enhanced')) score += 24;
  if (id.includes('siri')) score += 18;
  if (id.includes('ava')) score += 6;
  if (id.includes('samantha')) score += 5;
  if (id.includes('allison') || id.includes('nicky') || id.includes('nathan')) score += 3;
  return score;
}

function prepareVoice(): Promise<void> {
  if (voiceResolved || voicePromise) return voicePromise ?? Promise.resolve();
  voicePromise = Speech.getAvailableVoicesAsync()
    .then((voices) => {
      const ranked = voices
        .map((voice) => ({ voice, score: scoreVoice(voice) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score);
      voiceId = ranked[0]?.voice.identifier;
    })
    .catch(() => {
      voiceId = undefined;
    })
    .finally(() => {
      voiceResolved = true;
      voicePromise = null;
    });
  return voicePromise;
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
    try {
      for (const key of Object.keys(rockyModules) as RockyKind[]) {
        const player = audio.createAudioPlayer(rockyModules[key]);
        player.volume = 1;
        player.shouldCorrectPitch = true;
        rockyCache[key] = player;
      }
      rockyReady = true;
    } catch {
      for (const key of Object.keys(rockyCache) as RockyKind[]) {
        try {
          rockyCache[key]?.remove();
        } catch {
          // ignore
        }
        delete rockyCache[key];
      }
      rockyReady = false;
    }
    attachMusicPlayers((source) => audio.createAudioPlayer(source));
  } catch {
    releasePlayers();
    beepsUnavailable = true;
  }
}

export function initAudio(): Promise<void> {
  void prepareVoice();
  if (audioReady || beepsUnavailable) return Promise.resolve();
  if (!initPromise) {
    initPromise = preparePlayers().finally(() => {
      initPromise = null;
    });
  }
  return initPromise;
}

function playbackRateFor(settings: WorkoutSettings): number {
  const rate = settings.voiceRate;
  if (!Number.isFinite(rate)) return 1;
  return Math.min(1.15, Math.max(0.85, rate));
}

function speakFallback(text: string, settings: WorkoutSettings): void {
  try {
    Speech.stop();
    Speech.speak(text, {
      language: 'en-US',
      voice: voiceId,
      rate: Math.min(playbackRateFor(settings), 1),
      pitch: 0.98,
    });
  } catch {
    // ignore
  }
}

function pauseRocky(): void {
  for (const key of Object.keys(rockyCache) as RockyKind[]) {
    try {
      rockyCache[key]?.pause();
    } catch {
      // ignore
    }
  }
}

/** Recorded Rocky line when the clip is loaded. Tuned on-device voice if it is not. */
export function speakCue(cue: { key: string; line: string }, settings: WorkoutSettings): void {
  if (cue.key === 'finish') {
    void playBeep(settings, 'doneHeavy', rockyDuckMs('finish'));
  }
  if (!settings.speechEnabled || !cue.line.trim()) return;
  if (cue.key === 'go') holdBoundary(700);
  if (cue.key === 'round' || cue.key.startsWith('round:')) holdBoundary(rockyDuckMs(cue.key));
  const kind = rockyKind(cue.key);
  const player = kind && rockyReady ? rockyCache[kind] : undefined;
  if (!player) {
    duckMusic(rockyDuckMs(cue.key));
    speakFallback(cue.line, settings);
    return;
  }
  duckMusic(rockyDuckMs(cue.key));
  const token = ++rockyToken;
  try {
    Speech.stop();
  } catch {
    // ignore
  }
  pauseRocky();
  try {
    player.shouldCorrectPitch = true;
    player.playbackRate = playbackRateFor(settings);
    player.volume = 1;
    void player.seekTo(0).then(() => {
      if (token !== rockyToken) return;
      swallowPlayRejections(() => {
        player.play();
      });
    }).catch(() => {
      if (token !== rockyToken) return;
      speakFallback(cue.line, settings);
    });
  } catch {
    speakFallback(cue.line, settings);
  }
}

export function speak(text: string, settings: WorkoutSettings): void {
  speakCue({ key: 'fallback', line: text }, settings);
}

export function stopSpeech(force = false): void {
  if (!force && Date.now() < boundaryHoldUntil) return;
  boundaryHoldUntil = 0;
  rockyToken += 1;
  try {
    Speech.stop();
  } catch {
    // ignore
  }
  pauseRocky();
}

function swallowPlayRejections(run: () => void): void {
  if (typeof HTMLAudioElement === 'undefined') {
    run();
    return;
  }
  const proto = HTMLAudioElement.prototype;
  const original = proto.play;
  proto.play = function playWithCatch(this: HTMLAudioElement) {
    const result = original.call(this);
    if (result && typeof result.catch === 'function') result.catch(() => {});
    return result;
  };
  try {
    run();
  } finally {
    proto.play = original;
  }
}

/**
 * Web only. A Start tap can unlock audio, but pausing in the same turn aborts play()
 * and rejects. Play a silent tick, then stop it on a later turn.
 */
export function unlockRockyFromGesture(): void {
  if (typeof document === 'undefined' || !rockyReady) return;
  const player = rockyCache.welcome;
  if (!player) return;
  try {
    player.volume = 0;
    swallowPlayRejections(() => {
      player.play();
    });
    setTimeout(() => {
      try {
        if (player.volume !== 0) return;
        player.pause();
        void player.seekTo(0);
        player.volume = 1;
      } catch {
        // ignore
      }
    }, 80);
  } catch {
    // ignore
  }
}

const RUNG: Partial<Record<BeepKind, number>> = { rung3: 0.72, rung2: 0.86, rung1: 1 };

export async function playBeep(
  settings: WorkoutSettings,
  kind: BeepKind = 'go',
  duckMs: number = BEEP_DUCK_MS,
): Promise<void> {
  if (!settings.beepsEnabled || beepsUnavailable) return;
  try {
    if (!audioReady) await initAudio();
    const player = cache[kind];
    if (!player) return;
    if (duckMs > 0) duckMusic(duckMs);
    player.volume = kind === 'doneHeavy' || kind === 'win' ? 1 : (RUNG[kind] ?? 0.85);
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
