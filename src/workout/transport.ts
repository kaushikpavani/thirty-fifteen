/**
 * Mid-ride moves. Elapsed time is the playhead; these return the next playhead.
 *
 * Restart — current segment, from the top.
 * Shorten — finish the current segment now and continue (do not end the session).
 * Skip — leave the block you are in:
 *   warm-up / accel → first HARD
 *   HARD → its EASY
 *   EASY / set rest → the next HARD
 *   cool-down → the end of the session
 */

export type TransportSegment = {
  id: string;
  kind: string;
  durationMs: number;
};

export function segmentStartMs(segments: { durationMs: number }[], index: number): number {
  let acc = 0;
  const end = Math.max(0, Math.min(index, segments.length));
  for (let i = 0; i < end; i++) acc += segments[i].durationMs;
  return acc;
}

export function workoutTotalMs(segments: { durationMs: number }[]): number {
  return segments.reduce((sum, segment) => sum + segment.durationMs, 0);
}

function clampIndex(length: number, index: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

export function restartTargetMs(segments: { durationMs: number }[], index: number): number {
  if (segments.length === 0) return 0;
  return segmentStartMs(segments, clampIndex(segments.length, index));
}

/** Start of the next segment, or the end of the session when this is the last one. */
export function shortenTargetMs(segments: { durationMs: number }[], index: number): number {
  if (segments.length === 0) return 0;
  const safe = clampIndex(segments.length, index);
  if (safe >= segments.length - 1) return workoutTotalMs(segments);
  return segmentStartMs(segments, safe + 1);
}

export function skipTargetMs(segments: TransportSegment[], index: number): number {
  if (segments.length === 0) return 0;
  const safe = clampIndex(segments.length, index);
  const current = segments[safe];
  const total = workoutTotalMs(segments);
  const findAfter = (kind: string) => segments.findIndex((segment, i) => i > safe && segment.kind === kind);

  if (current.kind === 'warmup' || current.kind === 'accel') {
    const hard = segments.findIndex((segment) => segment.kind === 'hard');
    return hard >= 0 ? segmentStartMs(segments, hard) : shortenTargetMs(segments, safe);
  }

  if (current.kind === 'hard') return shortenTargetMs(segments, safe);

  if (current.kind === 'easy' || current.kind === 'set_rest') {
    const hard = findAfter('hard');
    if (hard >= 0) return segmentStartMs(segments, hard);
    const cool = findAfter('cooldown');
    if (cool >= 0) return segmentStartMs(segments, cool);
    return total;
  }

  if (current.kind === 'cooldown') return total;
  return shortenTargetMs(segments, safe);
}

/** Rocky keys that may speak again after the current segment is restarted. */
export function rockyKeysToRearm(segment: { id: string; kind: string }, atMs: number): string[] {
  const keys = [`hard:${segment.id}`, `easy:${segment.id}`];
  if (atMs <= 1000) keys.push('welcome');
  if (segment.kind === 'cooldown') keys.push('finish');
  return keys;
}
