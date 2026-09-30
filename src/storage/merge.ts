import type { WorkoutRecord } from '../types';

/**
 * Phone and cloud copies of the same session id. The later `endedAt` wins.
 * Newest-first. Never capped: dropping the oldest ride is still losing a ride.
 */
export function mergeRecords(local: WorkoutRecord[], remote: WorkoutRecord[]): WorkoutRecord[] {
  const map = new Map<string, WorkoutRecord>();
  for (const item of [...local, ...remote]) {
    const prev = map.get(item.id);
    if (!prev || item.endedAt > prev.endedAt) map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1));
}

/** Sessions a history wipe already covered. Newer rides stay. */
export function sessionsAfterWatermark(sessions: WorkoutRecord[], deletedThrough: string | null): WorkoutRecord[] {
  if (!deletedThrough) return sessions;
  return sessions.filter((session) => session.endedAt > deletedThrough);
}

/**
 * Merge after a local wipe. Remote rows at or before the watermark are ignored
 * so a late upload cannot put deleted rides back on this phone.
 */
export function applyCloudMerge(
  local: WorkoutRecord[],
  remote: WorkoutRecord[],
  deletedThrough: string | null,
): WorkoutRecord[] {
  return mergeRecords(
    sessionsAfterWatermark(local, deletedThrough),
    sessionsAfterWatermark(remote, deletedThrough),
  );
}

/**
 * A cloud sync should only ever add to what's already on screen — merging in
 * a rider's own local rides with whatever the cloud has is a strict union.
 * If a sync's result somehow comes back with fewer sessions than were
 * already showing (a bad response, a parsing edge case, anything not routed
 * through an explicit "delete my history" watermark), that is a bug, not a
 * real deletion — keep what was already on screen rather than let a sync
 * silently erase it.
 */
export function safeMergedSessions(shownBefore: WorkoutRecord[], merged: WorkoutRecord[]): WorkoutRecord[] {
  return merged.length >= shownBefore.length ? merged : shownBefore;
}
