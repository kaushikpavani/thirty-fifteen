/**
 * A short taste of a music style, played when the rider taps it in Settings.
 *
 * Seven seconds of that style's driving track with a fade-out, on its own
 * player so it can't disturb the ride's players. Tapping another style
 * replaces it; leaving the screen, turning music off or starting a ride
 * stops it. Pure over a player factory so it can be tested without audio.
 */
export type PreviewPlayer = {
  volume: number;
  loop: boolean;
  play: () => void;
  pause: () => void;
  remove: () => void;
};

export const PREVIEW_MS = 7000;
export const PREVIEW_FADE_MS = 1500;
export const PREVIEW_VOLUME = 0.85;
const STEP_MS = 100;

export function createMusicPreview(create: (source: number) => PreviewPlayer) {
  let current: { player: PreviewPlayer; timer: ReturnType<typeof setInterval> } | null = null;

  function stop(): void {
    const now = current;
    current = null;
    if (!now) return;
    clearInterval(now.timer);
    try {
      now.player.pause();
    } catch {
      // ignore
    }
    try {
      now.player.remove();
    } catch {
      // ignore
    }
  }

  /** Start a preview of `source`, replacing any running one. False if there was nothing to play or it couldn't start. */
  function play(source: number | undefined): boolean {
    stop();
    if (source == null) return false;
    try {
      const player = create(source);
      player.loop = false;
      player.volume = PREVIEW_VOLUME;
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += STEP_MS;
        if (elapsed >= PREVIEW_MS) {
          if (current?.timer === timer) stop();
          return;
        }
        const fadeFrom = PREVIEW_MS - PREVIEW_FADE_MS;
        if (elapsed > fadeFrom) {
          try {
            player.volume = Math.max(0, PREVIEW_VOLUME * (1 - (elapsed - fadeFrom) / PREVIEW_FADE_MS));
          } catch {
            // ignore
          }
        }
      }, STEP_MS);
      current = { player, timer };
      try {
        const result = player.play() as unknown;
        if (result && typeof (result as Promise<unknown>).catch === 'function') (result as Promise<unknown>).catch(() => stop());
      } catch {
        stop();
        return false;
      }
      return true;
    } catch {
      stop();
      return false;
    }
  }

  return { play, stop, isPlaying: () => current != null };
}
