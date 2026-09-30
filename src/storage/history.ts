import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewWorkoutRecord, WorkoutRecord } from '../types';
import { loadCachedAuthUser } from '../auth/sessionCache';
import { getSupabase } from '../auth/supabase';
import { ensureDevice } from './cloud';
import { cloudExtensionMissing, workoutRowsForRetry, workoutSessionWrite, type WorkoutSessionWrite } from './cloudRow';
import { parseStoredSummary } from '../logic/rideSummary';
import { loadDeletionState } from './deletionStore';
import { createId } from './id';
import { createQueue } from './queue';
import { createRideStore, parseRecord, type StoreRead } from './rideStore';
import { chunk, pendingBackup, planSync, toIso, type RemoteEntry } from './rideSync';

export { mergeRecords } from './merge';
export { createId };

/**
 * Rides on this phone are the source of truth, stored one key per ride
 * (see rideStore). The cloud is a backup: sync only ever adds rides in
 * either direction, and only the rider's own "Delete ride history"
 * removes rides from the phone.
 */

const store = createRideStore({
  getAllKeys: () => AsyncStorage.getAllKeys(),
  multiGet: (keys) => AsyncStorage.multiGet(keys),
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  multiRemove: (keys) => AsyncStorage.multiRemove(keys),
});

const writes = createQueue();

export function readRides(): Promise<StoreRead> {
  return writes(() => store.read());
}

/** Add or update rides. Never removes any. Retries once so a transient storage error doesn't drop a ride. */
export async function saveRides(rides: WorkoutRecord[]): Promise<boolean> {
  if (rides.length === 0) return true;
  return writes(async () => {
    try {
      await store.put(rides);
      return true;
    } catch {
      try {
        await store.put(rides);
        return true;
      } catch {
        return false;
      }
    }
  });
}

/** The rider asked to delete their history on this phone. Does not talk to the cloud. */
export async function clearHistory(): Promise<void> {
  await writes(() => store.removeAll());
}

export function withId(input: NewWorkoutRecord): WorkoutRecord {
  return { ...input, id: createId() };
}

// ——— Cloud backup ———

const COLUMNS =
  'id, started_at, ended_at, duration_ms, planned_duration_ms, ftp_watts, hard_watts, easy_watts, completed, completion_pct';
const PAGE = 1000;
const UPLOAD_CHUNK = 20;
const DOWNLOAD_CHUNK = 50;

function rowToRecord(row: Record<string, unknown>): WorkoutRecord | null {
  const startedAt = toIso(row.started_at);
  const endedAt = toIso(row.ended_at);
  if (!startedAt || !endedAt) return null;
  const record = parseRecord({
    id: row.id,
    startedAt,
    endedAt,
    durationMs: row.duration_ms,
    plannedDurationMs: row.planned_duration_ms,
    ftpWatts: row.ftp_watts,
    hardWatts: row.hard_watts,
    easyWatts: row.easy_watts,
    completed: row.completed,
    completionPct: row.completion_pct,
  });
  if (!record) return null;
  const summary = parseStoredSummary(row.summary);
  return summary ? { ...record, summary } : record;
}

type Supabase = NonNullable<ReturnType<typeof getSupabase>>;

/** Every ride id this account has in the cloud, page by page. RLS limits it to the signed-in rider. */
async function fetchRemoteIndex(supabase: Supabase): Promise<RemoteEntry[]> {
  const out: RemoteEntry[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id, ended_at')
      .order('ended_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: unknown; ended_at: unknown }[];
    for (const row of rows) {
      const endedAt = toIso(row.ended_at);
      if (typeof row.id === 'string' && endedAt) out.push({ id: row.id, endedAt });
    }
    if (rows.length < PAGE) return out;
  }
}

async function upsertRows(supabase: Supabase, rows: WorkoutSessionWrite[]): Promise<string | null> {
  const first = await supabase.from('workout_sessions').upsert(rows, { onConflict: 'id' });
  if (!first.error) return null;
  const retry = workoutRowsForRetry(rows, first.error.message);
  if (!retry) return first.error.message;
  const second = await supabase.from('workout_sessions').upsert(retry, { onConflict: 'id' });
  return second.error ? second.error.message : null;
}

/**
 * Upload in small batches. If a batch is rejected, try its rides one at a
 * time so a single bad ride can't keep the others from backing up.
 */
async function uploadRides(supabase: Supabase, rides: WorkoutRecord[], userId: string): Promise<Set<string>> {
  const done = new Set<string>();
  if (rides.length === 0) return done;
  const deviceId = await ensureDevice();
  for (const batch of chunk(rides, UPLOAD_CHUNK)) {
    const rows = batch.map((ride) => workoutSessionWrite(ride, userId, deviceId));
    if ((await upsertRows(supabase, rows)) == null) {
      for (const ride of batch) done.add(ride.id);
      continue;
    }
    for (const row of rows) {
      if ((await upsertRows(supabase, [row])) == null) done.add(row.id);
    }
  }
  return done;
}

async function downloadRides(supabase: Supabase, ids: string[]): Promise<WorkoutRecord[]> {
  const out: WorkoutRecord[] = [];
  for (const batch of chunk(ids, DOWNLOAD_CHUNK)) {
    const first = await supabase.from('workout_sessions').select(`${COLUMNS}, summary`).in('id', batch);
    let data = first.data as Record<string, unknown>[] | null;
    let error = first.error;
    if (error && cloudExtensionMissing(error.message) && /summary/i.test(error.message)) {
      const again = await supabase.from('workout_sessions').select(COLUMNS).in('id', batch);
      data = again.data as Record<string, unknown>[] | null;
      error = again.error;
    }
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const ride = rowToRecord(row);
      if (ride) out.push(ride);
    }
  }
  return out;
}

export type SyncResult =
  | { kind: 'signed-out' }
  | {
      kind: 'synced';
      /** Rides that were only in the cloud, already saved to the phone. */
      downloaded: WorkoutRecord[];
      /** Phone rides still not in the cloud after this pass. */
      pending: string[];
      reason: 'offline' | 'error' | null;
    };

function offline(message: string): boolean {
  return /network|fetch|timeout|offline|internet|connection/i.test(message);
}

/**
 * One backup pass: upload every phone ride the cloud doesn't have, then
 * download any cloud ride the phone doesn't have. Never removes a ride
 * from the phone, and never throws.
 */
export async function syncRides(local: WorkoutRecord[]): Promise<SyncResult> {
  const supabase = getSupabase();
  if (!supabase) return { kind: 'signed-out' };
  const user = await loadCachedAuthUser();
  if (!user) return { kind: 'signed-out' };
  const cutoff = (await loadDeletionState()).historyDeletedThrough;
  const everything = { kind: 'synced' as const, downloaded: [] as WorkoutRecord[] };
  let remote: RemoteEntry[];
  try {
    remote = await fetchRemoteIndex(supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    return {
      ...everything,
      pending: pendingBackup(local, new Set(), cutoff).map((ride) => ride.id),
      reason: offline(message) ? 'offline' : 'error',
    };
  }
  const plan = planSync(local, remote, cutoff);
  const cloudIds = new Set(remote.map((entry) => entry.id));
  let reason: 'offline' | 'error' | null = null;
  try {
    for (const id of await uploadRides(supabase, plan.upload, user.id)) cloudIds.add(id);
  } catch (err) {
    reason = offline(err instanceof Error ? err.message : '') ? 'offline' : 'error';
  }
  let downloaded: WorkoutRecord[] = [];
  try {
    downloaded = await downloadRides(supabase, plan.download);
    if (downloaded.length && !(await saveRides(downloaded))) downloaded = [];
  } catch (err) {
    reason = reason ?? (offline(err instanceof Error ? err.message : '') ? 'offline' : 'error');
  }
  const pending = pendingBackup(local, cloudIds, cutoff).map((ride) => ride.id);
  return { kind: 'synced', downloaded, pending, reason: pending.length ? (reason ?? 'error') : null };
}
