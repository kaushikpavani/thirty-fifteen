import type { RideSummary, WorkoutRecord } from '../types';

export type WorkoutSource = 'manual' | 'strava' | 'garmin' | 'ble';

/** Row written to `workout_sessions`. Manual rides leave `external_id` empty. */
export type WorkoutSessionWrite = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  planned_duration_ms: number;
  ftp_watts: number;
  hard_watts: number;
  easy_watts: number;
  completed: boolean;
  completion_pct: number;
  device_id: string | null;
  source: WorkoutSource;
  external_id: string | null;
  summary: RideSummary | null;
};

export type LegacyWorkoutSessionWrite = Omit<WorkoutSessionWrite, 'device_id' | 'source' | 'external_id' | 'summary'>;

export function workoutSessionWrite(
  record: WorkoutRecord,
  userId: string,
  deviceId: string | null,
): WorkoutSessionWrite {
  return {
    id: record.id,
    user_id: userId,
    started_at: record.startedAt,
    ended_at: record.endedAt,
    duration_ms: record.durationMs,
    planned_duration_ms: record.plannedDurationMs,
    ftp_watts: record.ftpWatts,
    hard_watts: record.hardWatts,
    easy_watts: record.easyWatts,
    completed: record.completed,
    completion_pct: record.completionPct,
    device_id: deviceId,
    source: 'manual',
    external_id: null,
    summary: record.summary ?? null,
  };
}

export function omitSessionSummary(row: WorkoutSessionWrite): Omit<WorkoutSessionWrite, 'summary'> {
  const { summary, ...rest } = row;
  void summary;
  return rest;
}

export function legacyWorkoutSessionWrite(row: WorkoutSessionWrite): LegacyWorkoutSessionWrite {
  return {
    id: row.id,
    user_id: row.user_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_ms: row.duration_ms,
    planned_duration_ms: row.planned_duration_ms,
    ftp_watts: row.ftp_watts,
    hard_watts: row.hard_watts,
    easy_watts: row.easy_watts,
    completed: row.completed,
    completion_pct: row.completion_pct,
  };
}

/** PostgREST or Postgres complaining that the new session columns are not there yet. */
export function cloudExtensionMissing(message: string): boolean {
  return (
    (/schema cache/i.test(message) && /device_id|source|external_id|summary/i.test(message)) ||
    /could not find the '(device_id|source|external_id|summary)' column/i.test(message) ||
    /column "(device_id|source|external_id|summary)" of relation "workout_sessions" does not exist/i.test(message)
  );
}

export function workoutDeviceForeignKey(message: string): boolean {
  return /device_id/i.test(message) && /foreign key|violates/i.test(message);
}

export function workoutRowsForRetry(
  rows: WorkoutSessionWrite[],
  message: string,
): Array<WorkoutSessionWrite | LegacyWorkoutSessionWrite | Omit<WorkoutSessionWrite, 'summary'>> | null {
  if (cloudExtensionMissing(message)) {
    if (/device_id|source|external_id/i.test(message)) return rows.map(legacyWorkoutSessionWrite);
    if (/summary/i.test(message)) return rows.map(omitSessionSummary);
    return rows.map(legacyWorkoutSessionWrite);
  }
  if (workoutDeviceForeignKey(message)) return rows.map((row) => ({ ...row, device_id: null }));
  return null;
}

/** Feedback insert failed because `device_id` is missing or not a known install. */
export function feedbackDeviceProblem(message: string): boolean {
  return /device_id/i.test(message) && /schema cache|could not find|does not exist|foreign key|violates/i.test(message);
}

/** The row is already in the cloud, so the outbox copy can be dropped. */
export function cloudDuplicate(message: string): boolean {
  return /duplicate key|unique constraint|23505/i.test(message);
}

/**
 * A missing error is success. A duplicate key is also success: the retry
 * found the row from the previous flush. Any other message stays queued.
 */
export function insertAccepted(errorMessage: string | null): boolean {
  return errorMessage == null || cloudDuplicate(errorMessage);
}

export function clientColumnMissing(column: 'client_id' | 'client_event_id', message: string): boolean {
  return new RegExp(column, 'i').test(message) && /schema cache|could not find|does not exist/i.test(message);
}

export function trimOutbox<T>(items: T[], max: number): T[] {
  return items.slice(0, Math.max(0, max));
}

/**
 * Drop ids that a flush already delivered, using the outbox as it is now.
 * Rows enqueued while the flush was in flight stay queued.
 */
export function withoutSent<T extends { id: string }>(latest: readonly T[], sentIds: ReadonlySet<string>): T[] {
  return latest.filter((item) => !sentIds.has(item.id));
}
