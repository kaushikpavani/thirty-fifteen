/**
 * Set a player's speed without ever stopping the sound.
 *
 * On a real iPhone the native player exposes `playbackRate` and
 * `shouldCorrectPitch` as read-only properties: assigning to them throws
 * ("Cannot assign to property 'playbackRate' which has only a getter"). That
 * used to abort the whole voice clip and drop the rider to the system voice.
 * `setPlaybackRate(rate, quality)` is the supported call; plain assignment is
 * only a fallback for players that offer nothing else. A speed that can't be
 * set means the clip plays at normal speed, never that it doesn't play.
 */
export type RatePlayer = {
  playbackRate?: number;
  shouldCorrectPitch?: boolean;
  setPlaybackRate?: (rate: number, pitchCorrectionQuality?: 'low' | 'medium' | 'high') => void;
};

/** True if the speed was applied (or already was). */
export function setPlayerRate(player: RatePlayer, rate: number): boolean {
  if (!Number.isFinite(rate) || rate <= 0) return false;
  try {
    if (typeof player.setPlaybackRate === 'function') {
      player.setPlaybackRate(rate, 'high');
      return true;
    }
  } catch {
    // fall through to the plain property
  }
  try {
    player.playbackRate = rate;
    return true;
  } catch {
    return false;
  }
}
