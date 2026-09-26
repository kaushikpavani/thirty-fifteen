import type { WorkoutRecord } from '../types';

/**
 * Phone and cloud copies of the same session id. The later `endedAt` wins.
 * The result is newest-first and capped, matching the on-device history list.
 */
export function mergeRecords(local: WorkoutRecord[], remote: WorkoutRecord[]): WorkoutRecord[] {
  const map = new Map<string, WorkoutRecord>();
  for (const item of [...local, ...remote]) {
    const prev = map.get(item.id);
    if (!prev || item.endedAt > prev.endedAt) map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1)).slice(0, 200);
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
