/**
 * Honest ride time.
 *
 * The ride clock is a playhead through the session. Skipping or halving the
 * warm-up jumps the playhead forward, and restarting a block jumps it back,
 * but neither is time the rider spent. Every jump is added to a running
 * "skew", and the time shown and saved is playhead minus skew: the minutes
 * actually spent riding, whatever was skipped.
 */
export function addJump(skewMs: number, fromMs: number, toMs: number): number {
  const skew = Number.isFinite(skewMs) ? skewMs : 0;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return skew;
  return skew + (toMs - fromMs);
}

/** Minutes actually spent, never negative and never more than the playhead plus every restart. */
export function activeRideMs(playheadMs: number, skewMs: number): number {
  if (!Number.isFinite(playheadMs)) return 0;
  const skew = Number.isFinite(skewMs) ? skewMs : 0;
  return Math.max(0, Math.round(playheadMs - skew));
}
