import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadCachedAuthUser } from '../auth/sessionCache';
import { getSupabase } from '../auth/supabase';
import type { WorkoutSettings } from '../types';
import { createQueue } from './queue';
import { parseCloudSettings, planSettingsSync } from './settingsSync';

/**
 * Settings backup against the rider's account (see settingsSync for the
 * rules). Stored in the `prefs` column of the rider's own `profiles` row,
 * which only they can read or write.
 */

const PENDING_KEY = '@thirtyfifteen/settings-sync/v1';
const PREFS_VERSION = 1;

let pending: Set<string> | null = null;
const jobs = createQueue();

async function loadPending(): Promise<Set<string>> {
  if (pending) return pending;
  const fromMemory: Set<string> = pending ?? new Set<string>();
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) for (const key of parsed) if (typeof key === 'string') fromMemory.add(key);
  } catch {
    // An unreadable list only means those changes are treated as already synced.
  }
  pending = fromMemory;
  return pending;
}

async function savePending(): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...(pending ?? [])]));
  } catch {
    // Still held in memory for this run.
  }
}

/** Record settings the rider just changed, so they are sent on the next sync and can't be overwritten by a restore. */
export function notePendingSettings(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return Promise.resolve();
  return jobs(async () => {
    const list = await loadPending();
    for (const key of keys) list.add(key);
    await savePending();
  });
}

export type SettingsSyncResult =
  | { kind: 'signed-out' }
  | { kind: 'failed' }
  /** `apply` is what the phone should adopt (null when already up to date). */
  | { kind: 'synced'; apply: Partial<WorkoutSettings> | null; uploaded: boolean };

/**
 * One backup pass: read the account's settings, send this phone's pending
 * changes, and report what the phone should adopt. Never throws. On any
 * failure nothing changes and the pending list is kept for next time.
 */
export function syncSettings(local: WorkoutSettings): Promise<SettingsSyncResult> {
  return jobs(async (): Promise<SettingsSyncResult> => {
    try {
      const supabase = getSupabase();
      const user = supabase ? await loadCachedAuthUser() : null;
      if (!supabase || !user) return { kind: 'signed-out' };

      const read = await supabase.from('profiles').select('prefs').eq('id', user.id).maybeSingle();
      if (read.error) return { kind: 'failed' };
      const prefs = (read.data as { prefs?: unknown } | null)?.prefs;
      const remote = parseCloudSettings(prefs && typeof prefs === 'object' ? (prefs as { settings?: unknown }).settings : null);

      const list = await loadPending();
      const sent = [...list];
      const plan = planSettingsSync({ local, remote, pending: sent });

      if (plan.upload) {
        const row = { id: user.id, prefs: { v: PREFS_VERSION, settings: plan.upload, updatedAt: new Date().toISOString() } };
        const write = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
        if (write.error) return { kind: 'failed' };
      }
      // Only what was actually sent is cleared; anything changed while this ran stays pending.
      for (const key of sent) list.delete(key);
      await savePending();
      return { kind: 'synced', apply: plan.apply, uploaded: plan.upload != null };
    } catch {
      return { kind: 'failed' };
    }
  });
}
