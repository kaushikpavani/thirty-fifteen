/**
 * How a running ride shares the speaker.
 *
 * iOS background audio is `UIBackgroundModes: audio`. The session mixes, and
 * ducks other apps only while a cue is already silencing our bed.
 *
 * Android has no equivalent background mode. Sustained playback needs the
 * media foreground service that `setActiveForLockScreen` starts
 * (`FOREGROUND_SERVICE_MEDIA_PLAYBACK`, type `mediaPlayback`). Expo's sample
 * uses `doNotMix` for that session, which asks for exclusive focus and pauses
 * the rider's other audio. `duckOthers` still requests focus
 * (`AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`), so the service stays the active
 * player, and other apps keep playing at a lower volume.
 */

export type InterruptionMode = 'mixWithOthers' | 'duckOthers' | 'doNotMix';

export function workoutInterruptionMode(input: {
  platform: string;
  background: boolean;
  foreignDucks: number;
}): InterruptionMode {
  if (!input.background) return 'mixWithOthers';
  if (input.platform === 'android') return 'duckOthers';
  return input.foreignDucks > 0 ? 'duckOthers' : 'mixWithOthers';
}
