import { Platform } from 'react-native';
import { kickBed, setSessionHold } from './music';

/**
 * Audio session for a running ride.
 *
 * Checked against expo-audio SDK 57 `setAudioModeAsync` / `InterruptionMode`
 * and the iOS implementation (`AVAudioSession` category `.playback`):
 *
 * - `mixWithOthers` plays alongside other apps. On Android it requests no focus.
 * - `duckOthers` keeps other apps playing, quieter, while our session plays.
 *   iOS sets `.duckOthers`. The bed loops for the whole ride, so leaving this
 *   on would duck YouTube from Start until the end.
 * - `doNotMix` pauses other apps. `setActiveForLockScreen` requires it, and
 *   Android needs that lock-screen session or background playback stops after
 *   about three minutes.
 *
 * iOS rests on `mixWithOthers` and uses `duckOthers` only while a cue is already
 * silencing the bed. Android stays on `doNotMix` for the whole ride.
 * `playsInSilentMode` uses the playback category, so the iOS silent switch
 * does not mute the ride.
 */

type InterruptionMode = 'mixWithOthers' | 'doNotMix' | 'duckOthers';
type ExpoAudioModule = Pick<typeof import('expo-audio'), 'setAudioModeAsync'>;

let expoAudio: ExpoAudioModule | null | undefined;
let workoutAudio = false;
let audioGeneration = 0;
let foreignDucks = 0;
let modeChain: Promise<void> = Promise.resolve();

function loadExpoAudio(): ExpoAudioModule | null {
  if (expoAudio !== undefined) return expoAudio;
  try {
    expoAudio = require('expo-audio') as ExpoAudioModule;
  } catch {
    expoAudio = null;
  }
  return expoAudio;
}

function interruptionMode(background: boolean): InterruptionMode {
  if (!background) return 'mixWithOthers';
  if (Platform.OS === 'android') return 'doNotMix';
  return foreignDucks > 0 ? 'duckOthers' : 'mixWithOthers';
}

function enqueueSession(background: boolean): Promise<void> {
  const generation = audioGeneration;
  const run = modeChain.then(() => applySession(generation, background));
  modeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function applySession(generation: number, background: boolean): Promise<void> {
  if (generation !== audioGeneration) return;
  const audio = loadExpoAudio();
  if (!audio) return;
  try {
    await audio.setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: background,
      interruptionMode: interruptionMode(background),
    });
  } catch {
    return;
  }
  if (generation !== audioGeneration || !background || !workoutAudio) return;
  kickBed();
}

/** Foreground mix, before a ride starts. Does not override an active ride. */
export function configureIdleAudio(): Promise<void> {
  if (workoutAudio) return Promise.resolve();
  const audio = loadExpoAudio();
  if (!audio) return Promise.resolve();
  return audio
    .setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    })
    .catch(() => undefined);
}

/** Arm background playback. The looping bed holds the session between cues. */
export function enterWorkoutAudio(): Promise<void> {
  audioGeneration += 1;
  workoutAudio = true;
  setSessionHold(true);
  return enqueueSession(true);
}

/** Drop background playback. Call before pausing or stopping the bed. */
export function leaveWorkoutAudio(): void {
  audioGeneration += 1;
  workoutAudio = false;
  foreignDucks = 0;
  setSessionHold(false);
  void enqueueSession(false);
}

/**
 * iOS only. Duck other apps for this cue, then mix again.
 * Android stays on `doNotMix` so the media session is left alone.
 */
export function holdForeignDuck(ms: number): void {
  if (Platform.OS !== 'ios' || !workoutAudio || ms <= 0) return;
  foreignDucks += 1;
  if (foreignDucks === 1) void enqueueSession(true);
  setTimeout(() => {
    foreignDucks = Math.max(0, foreignDucks - 1);
    if (!workoutAudio || foreignDucks > 0) return;
    void enqueueSession(true);
  }, ms);
}
