/**
 * Android notification play/pause, reduced from expo-audio status events.
 *
 * Checked against expo-audio SDK 57 (Android `BaseAudioPlayer`):
 * periodic `playbackStatusUpdate` ticks run only while `playing` is true.
 * A pause delivers one `playing: false` sample, then the ticker stops.
 * Confirming pause with a second sample would never fire.
 *
 * A looping bed does not sit in `STATE_ENDED` (ExoPlayer `REPEAT_MODE_ONE`).
 * `didJustFinish` is the natural end, or a loop that actually stopped, not a
 * finger on the notification. Ignoring a low `currentTime` as well would
 * swallow a real pause in the first fraction of a loop: the playhead stays
 * there, and no second sample arrives.
 */

export type RemoteStatus = {
  playing: boolean;
  didJustFinish?: boolean;
};

export type RemoteIntent = 'play' | 'pause';

export type RemoteState = {
  previous: boolean | null;
  pending: boolean | null;
};

export const INITIAL_REMOTE_STATE: RemoteState = { previous: null, pending: null };

/**
 * True when this sample is the echo of our own `play()` or `pause()`.
 * A sample that disagrees with the command we just issued is the rider.
 */
export function isSuppressedEcho(
  nowMs: number,
  suppressUntilMs: number,
  expectPlaying: boolean | null,
  playing: boolean,
): boolean {
  return nowMs < suppressUntilMs && expectPlaying !== null && playing === expectPlaying;
}

/**
 * Pause confirms on one `playing: false` sample.
 * Play confirms on two `playing: true` samples (the edge, then the next tick),
 * so a one-tick blip does not resume the ride.
 * The first sample after startup is adopted and never emits play.
 */
export function reduceRemoteTransport(
  state: RemoteState,
  status: RemoteStatus,
  suppressedEcho: boolean,
): { state: RemoteState; intent: RemoteIntent | null } {
  if (status.didJustFinish) {
    return { state: { previous: state.previous, pending: null }, intent: null };
  }
  if (suppressedEcho || state.previous === null) {
    return { state: { previous: status.playing, pending: null }, intent: null };
  }
  if (!status.playing) {
    if (state.previous === false) {
      return { state: { previous: false, pending: null }, intent: null };
    }
    return { state: { previous: false, pending: null }, intent: 'pause' };
  }
  if (state.previous === true) {
    return { state: { previous: true, pending: null }, intent: null };
  }
  if (state.pending !== true) {
    return { state: { previous: state.previous, pending: true }, intent: null };
  }
  return { state: { previous: true, pending: null }, intent: 'play' };
}
