import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewWorkoutRecord, WorkoutRecord } from '../types';
import { getSupabase } from '../auth/supabase';
import { ensureDevice } from './cloud';
import { workoutRowsForRetry, workoutSessionWrite, type WorkoutSessionWrite } from './cloudRow';
import { createId } from './id';

const KEY = '@thirtyfifteen/history/v1';

export { createId };

function isRecord(value: unknown): value is WorkoutRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<WorkoutRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.startedAt === 'string' &&
    typeof record.endedAt === 'string' &&
    typeof record.durationMs === 'number' &&
    typeof record.plannedDurationMs === 'number' &&
    typeof record.ftpWatts === 'number' &&
    typeof record.hardWatts === 'number' &&
    typeof record.easyWatts === 'number' &&
    typeof record.completed === 'boolean' &&
    typeof record.completionPct === 'number'
  );
}

export function mergeRecords(local: WorkoutRecord[], remote: WorkoutRecord[]): WorkoutRecord[] {
  const map = new Map<string, WorkoutRecord>();
  for (const item of [...local, ...remote]) {
    const prev = map.get(item.id);
    if (!prev || item.endedAt > prev.endedAt) map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1)).slice(0, 200);
}

export async function loadHistory(): Promise<WorkoutRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord);
  } catch {
    return [];
  }
}

export async function saveHistory(sessions: WorkoutRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(sessions.slice(0, 200)));
  } catch {
    // ignore
  }
}

export function withId(input: NewWorkoutRecord): WorkoutRecord {
  return { ...input, id: createId() };
}

type CloudResult = {
  sessions: WorkoutRecord[];
  note: string | null;
};

function rowToRecord(row: Record<string, unknown>): WorkoutRecord | null {
  const record = {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    plannedDurationMs: row.planned_duration_ms,
    ftpWatts: row.ftp_watts,
    hardWatts: row.hard_watts,
    easyWatts: row.easy_watts,
    completed: row.completed,
    completionPct: row.completion_pct,
  };
  return isRecord(record) ? record : null;
}

function cloudNote(message: string): string {
  if (/workout_sessions|schema cache|relation/i.test(message)) {
    return 'Cloud table missing. Sessions stay on this phone.';
  }
  return 'Couldn’t reach the cloud. Sessions are on this phone.';
}

async function upsertWorkoutRows(rows: WorkoutSessionWrite[]): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase || rows.length === 0) return null;
  const first = await supabase.from('workout_sessions').upsert(rows, { onConflict: 'id' });
  if (!first.error) return null;
  const retry = workoutRowsForRetry(rows, first.error.message);
  if (!retry) return first.error.message;
  const second = await supabase.from('workout_sessions').upsert(retry, { onConflict: 'id' });
  return second.error ? second.error.message : null;
}

export async function pushSession(record: WorkoutRecord): Promise<string | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return null;
    const deviceId = await ensureDevice();
    const message = await upsertWorkoutRows([workoutSessionWrite(record, userId, deviceId)]);
    return message ? cloudNote(message) : null;
  } catch {
    return 'Couldn’t reach the cloud. Sessions are on this phone.';
  }
}

export async function pullAndMerge(local: WorkoutRecord[]): Promise<CloudResult> {
  try {
    return await pullAndMergeUnsafe(local);
  } catch {
    return { sessions: local, note: 'Couldn’t reach the cloud. Sessions are on this phone.' };
  }
}

async function pullAndMergeUnsafe(local: WorkoutRecord[]): Promise<CloudResult> {
  const supabase = getSupabase();
  if (!supabase) return { sessions: local, note: null };
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { sessions: local, note: null };

  const { data, error } = await supabase
    .from('workout_sessions')
    .select(
      'id, started_at, ended_at, duration_ms, planned_duration_ms, ftp_watts, hard_watts, easy_watts, completed, completion_pct',
    )
    .order('ended_at', { ascending: false })
    .limit(200);

  if (error) {
    const note = /workout_sessions|schema cache|relation/i.test(error.message)
      ? 'Cloud table missing. Sessions stay on this phone.'
      : 'Couldn’t reach the cloud. Sessions are on this phone.';
    return { sessions: local, note };
  }

  const remote = (data ?? [])
    .map((row) => rowToRecord(row as Record<string, unknown>))
    .filter((row): row is WorkoutRecord => row != null);
  const merged = mergeRecords(local, remote);
  const remoteIds = new Set(remote.map((item) => item.id));
  const missing = merged.filter((item) => !remoteIds.has(item.id));
  if (missing.length) {
    const deviceId = await ensureDevice();
    const upsertError = await upsertWorkoutRows(missing.map((item) => workoutSessionWrite(item, userId, deviceId)));
    if (upsertError) {
      return {
        sessions: merged,
        note: 'Saved on this phone. Cloud sync did not finish.',
      };
    }
  }
  return { sessions: merged, note: null };
}
