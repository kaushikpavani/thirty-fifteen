/**
 * What happens when the rider ends a ride by hand.
 *
 * The point of a 30/15 session is the hard reps. Once the last one is done
 * the work is in the bag, so ending during the cool-down just saves the
 * ride. Ending before that asks the rider: keep what they did, or throw it
 * away. A few seconds on the clock is a mis-tap and there is nothing to ask
 * about.
 */
import { MIN_SAVE_MS } from './rideRecord';

type Seg = { kind: string; durationMs: number };

export type EndChoice = 'save' | 'ask' | 'nothing';

/** True once the last hard rep has been ridden to its end. */
export function setsComplete(segments: readonly Seg[], elapsedMs: number): boolean {
  let at = 0;
  let lastHardEnd: number | null = null;
  for (const seg of segments) {
    at += Math.max(0, seg.durationMs);
    if (seg.kind === 'hard') lastHardEnd = at;
  }
  // A session with no hard reps has nothing left to complete.
  if (lastHardEnd == null) return true;
  return Number.isFinite(elapsedMs) && elapsedMs >= lastHardEnd;
}

export function endChoice(segments: readonly Seg[], elapsedMs: number): EndChoice {
  if (!Number.isFinite(elapsedMs) || elapsedMs < MIN_SAVE_MS) return 'nothing';
  return setsComplete(segments, elapsedMs) ? 'save' : 'ask';
}
