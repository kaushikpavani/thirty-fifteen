/**
 * Workout elapsed time is wall time, not a count of timer ticks.
 * A late interval still reports the real elapsed milliseconds.
 * Time spent paused is `pausedAccum` and does not grow until resume.
 */

/** Elapsed ms while the clock is running. A backwards or non-finite step does not rewind. */
export function runningElapsed(nowMs: number, anchorMs: number, pausedAccumMs: number): number {
  const accum = Number.isFinite(pausedAccumMs) ? pausedAccumMs : 0;
  const delta = nowMs - anchorMs;
  if (!Number.isFinite(delta) || delta < 0) return accum;
  return accum + delta;
}

/**
 * Running ticks never move the playhead backwards, so a cue window cannot open twice.
 * Seek sets the cursor itself; it does not go through this helper.
 */
export function nextPlayhead(previousMs: number, wallMs: number, totalMs: number): number {
  const previous = Number.isFinite(previousMs) ? Math.max(previousMs, 0) : 0;
  if (!Number.isFinite(wallMs)) return previous;
  const total = Number.isFinite(totalMs) ? Math.max(totalMs, 0) : previous;
  const capped = Math.min(Math.max(wallMs, 0), total);
  return Math.max(previous, capped);
}

export type PlayheadStep = {
  fromMs: number;
  toMs: number;
  /** False when this sample does not move the ride. The engine skips it. */
  commit: boolean;
  deliver: boolean;
  finished: boolean;
};

/**
 * One running sample, shared by the 100ms timer and by coming back to the foreground.
 * A backwards wall does not commit a new range. Reaching `totalMs` finishes even
 * when the playhead was already there.
 */
export function stepPlayhead(previousMs: number, wallMs: number, totalMs: number): PlayheadStep {
  const fromMs = Number.isFinite(previousMs) ? Math.max(previousMs, 0) : 0;
  const toMs = nextPlayhead(fromMs, wallMs, totalMs);
  const commit = !(toMs === fromMs && wallMs < totalMs);
  return {
    fromMs,
    toMs,
    commit,
    deliver: commit && toMs > fromMs,
    finished: commit && wallMs >= totalMs,
  };
}
