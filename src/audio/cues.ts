import * as Speech from 'expo-speech';
import type { CoachVoice, WorkoutSettings } from '../types';
import { attachMusicPlayers, duckMusic, releaseMusicPlayers } from './music';
import { configureIdleAudio, holdForeignDuck } from './session';
import { BEEP_DUCK_MS, ladderBeep, rockyDuckMs, type LadderStep } from './spirit';
import { VOICE_CLIPS } from './voiceClips';
import { resolveClip, type RecordedVoice } from './voices';

const beepModules = {
  go: require('../../assets/beep-go.wav'),
  easy: require('../../assets/beep-easy.wav'),
  warn: require('../../assets/beep-warn.wav'),
  done: require('../../assets/beep-done.wav'),
  rung3: require('../../assets/beep-rung-3.wav'),
  rung3b: require('../../assets/beep-rung-3b.wav'),
  rung3c: require('../../assets/beep-rung-3c.wav'),
  rung2: require('../../assets/beep-rung-2.wav'),
  rung2b: require('../../assets/beep-rung-2b.wav'),
  rung2c: require('../../assets/beep-rung-2c.wav'),
  rung1: require('../../assets/beep-rung-1.wav'),
  rung1b: require('../../assets/beep-rung-1b.wav'),
  rung1c: require('../../assets/beep-rung-1c.wav'),
  win: require('../../assets/beep-win.wav'),
  doneHeavy: require('../../assets/beep-done-heavy.wav'),
} as const;

/** Recorded coach clips, one table per voice. Only the selected voice is loaded. */
type VoiceTable = Record<string, number>;
const voiceModules = VOICE_CLIPS as unknown as Record<RecordedVoice, VoiceTable>;

type BeepKind = keyof typeof beepModules;
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
const rockyCache: Partial<Record<string, Player>> = {};
let loadedVoice: RecordedVoice | null = null;

const NOVELTY =
  /eloquence|bad news|bahh|bells|boing|bubbles|cellos|zarvox|trinoids|whisper|organ|superstar|jester|\bflo\b|grandma|grandpa|junior|kathy|ralph|albert/i;

/**
 * Load expo-audio only when cues are needed so a missing native module cannot
 * crash the app during the initial bundle evaluation.
 */
function loadExpoAudio(): ExpoAudioModule | null {
  if (expoAudio !== undefined) return expoAudio;
  try {
    // Lazy on purpose: a missing native module must not crash the bundle at load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  releaseVoicePlayers();
  releaseMusicPlayers();
  audioReady = false;
  rockyReady = false;
  boundaryHoldUntil = 0;
}

function releaseVoicePlayers(): void {
  for (const key of Object.keys(rockyCache)) {
    try {
      rockyCache[key]?.remove();
    } catch {
      // ignore
    }
    delete rockyCache[key];
  }
  rockyReady = false;
  loadedVoice = null;
}

/** Load the selected coach's clips, releasing any other voice. Cheap when already loaded. */
export function setCoachVoice(voice: CoachVoice): void {
  if (voice === 'off') return;
  if (loadedVoice === voice && rockyReady) return;
  const audio = loadExpoAudio();
  if (!audio || beepsUnavailable) return;
  releaseVoicePlayers();
  try {
    const table = voiceModules[voice];
    for (const key of Object.keys(table)) {
      const player = audio.createAudioPlayer(table[key]!, { keepAudioSessionActive: true });
      player.volume = 1;
      player.shouldCorrectPitch = true;
      rockyCache[key] = player;
    }
    loadedVoice = voice;
    rockyReady = true;
  } catch {
    releaseVoicePlayers();
  }
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
  // Some enhanced system voices include the word "premium" in the name. That is not a product tier.
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

function duckFor(ms: number): void {
  if (ms <= 0) return;
  duckMusic(ms);
  holdForeignDuck(ms);
}

async function preparePlayers(): Promise<void> {
  if (audioReady || beepsUnavailable) return;
  const audio = loadExpoAudio();
  if (!audio) return;
  try {
    await configureIdleAudio();
    const playerOptions = { keepAudioSessionActive: true as const };
    for (const key of Object.keys(beepModules) as BeepKind[]) {
      const player = audio.createAudioPlayer(beepModules[key], playerOptions);
      player.volume = 0.85;
      cache[key] = player;
    }
    audioReady = true;
    // The selected coach loads at Start (setCoachVoice), so only one voice is ever in memory.
    attachMusicPlayers((source) =>
      audio.createAudioPlayer(source, { ...playerOptions, updateInterval: 250 }),
    );
  } catch {
    releasePlayers();
    beepsUnavailable = true;
  }
}

export { enterWorkoutAudio, leaveWorkoutAudio } from './session';

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
  for (const key of Object.keys(rockyCache)) {
    try {
      rockyCache[key]?.pause();
    } catch {
      // ignore
    }
  }
}

/** Recorded coach line in the selected voice. Tuned on-device voice if the clip is missing. */
export function speakCue(
  cue: { key: string; line: string; clip?: string; rep?: number },
  settings: WorkoutSettings,
): void {
  if (cue.key === 'finish') {
    void playBeep(settings, 'doneHeavy', rockyDuckMs('finish'));
  }
  if (!settings.speechEnabled || settings.coachVoice === 'off' || !cue.line.trim()) return;
  const voice: RecordedVoice = settings.coachVoice ?? 'calm';
  const take = cue.key === 'fallback' ? { clip: '', line: cue.line } : resolveClip(voice, cue);
  if (!take) return;
  if (cue.key === 'go') holdBoundary(700);
  if (cue.key.startsWith('count:')) holdBoundary(900);
  if (cue.key === 'round' || cue.key.startsWith('round:')) holdBoundary(rockyDuckMs(cue.key));
  setCoachVoice(voice);
  const player = take.clip && rockyReady ? rockyCache[take.clip] : undefined;
  duckFor(rockyDuckMs(cue.key));
  if (!player) {
    speakFallback(take.line, settings);
    return;
  }
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
    void player
      .seekTo(0)
      .then(() => {
        if (token !== rockyToken) return;
        swallowPlayRejections(() => {
          player.play();
        });
      })
      .catch(() => {
        if (token !== rockyToken) return;
        speakFallback(take.line, settings);
      });
  } catch {
    speakFallback(take.line, settings);
  }
}

/** Settings preview: one short sample in the chosen voice. */
export async function previewVoice(voice: CoachVoice, settings: WorkoutSettings): Promise<void> {
  if (voice === 'off') return;
  await initAudio();
  speakCue({ key: 'preview', line: 'Halfway.', clip: 'preview' }, { ...settings, speechEnabled: true, coachVoice: voice });
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

function rungVolume(kind: BeepKind): number | undefined {
  if (kind.startsWith('rung3')) return 0.72;
  if (kind.startsWith('rung2')) return 0.86;
  if (kind.startsWith('rung1')) return 1;
  return undefined;
}

export function playLadder(
  settings: WorkoutSettings,
  step: LadderStep,
  texture: 'pitch' | 'volume' | 'strongThird',
  duckMs: number,
): Promise<void> {
  if (texture === 'volume') {
    const volume = step === 'three' ? 0.42 : step === 'two' ? 0.7 : 1;
    return playBeep(settings, 'rung2', duckMs, volume);
  }
  if (texture === 'strongThird') {
    const volume = step === 'one' ? 1 : 0.38;
    const kind = step === 'one' ? 'rung1' : 'rung3';
    return playBeep(settings, kind, duckMs, volume);
  }
  return playBeep(settings, ladderBeep(step, 0) as BeepKind, duckMs, 0.9);
}

export async function playBeep(
  settings: WorkoutSettings,
  kind: BeepKind = 'go',
  duckMs: number = BEEP_DUCK_MS,
  volume?: number,
): Promise<void> {
  if (!settings.beepsEnabled || beepsUnavailable) return;
  try {
    if (!audioReady) await initAudio();
    const player = cache[kind];
    if (!player) return;
    if (duckMs > 0) duckFor(duckMs);
    player.volume =
      volume ?? (kind === 'doneHeavy' || kind === 'win' ? 1 : (rungVolume(kind) ?? 0.85));
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
