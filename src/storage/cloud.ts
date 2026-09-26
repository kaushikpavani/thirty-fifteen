import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getSupabase } from '../auth/supabase';
import type { AuthUser } from '../types';
import { createId, isInstallId } from './id';
import { loadSettings } from './settings';

const DEVICE_KEY = '@thirtyfifteen/device_id/v1';

type EventProperties = Record<string, string | number | boolean | null>;

let clientSessionId: string | null = null;
let opening: Promise<void> | null = null;

function sessionId(): string {
  if (!clientSessionId) clientSessionId = createId();
  return clientSessionId;
}

/** Stable id for this install. Stored on the phone even when the cloud is off. */
export async function localDeviceId(): Promise<string | null> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_KEY);
    if (existing && isInstallId(existing)) return existing;
    const id = createId();
    if (!isInstallId(id)) return null;
    await AsyncStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * Ensure the install row exists and bump last_seen.
 * Returns the id only when the cloud accepted it, so callers do not send a
 * foreign key the database does not have yet.
 */
export async function ensureDevice(): Promise<string | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const id = await localDeviceId();
    if (!id) return null;
    const version = Constants.expoConfig?.version ?? null;
    const { error } = await supabase.rpc('touch_device', {
      p_id: id,
      p_platform: Platform.OS,
      p_app_version: version,
    });
    if (error) return null;
    return id;
  } catch {
    return null;
  }
}

/** Append-only analytics. No-ops when Supabase is not configured. */
export async function track(eventName: string, properties: EventProperties = {}): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase) return;
    const deviceId = await ensureDevice();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id ?? null;
    await supabase.from('app_events').insert({
      event_name: eventName,
      user_id: userId,
      device_id: deviceId,
      client_session_id: sessionId(),
      properties,
    });
  } catch {
    // The ride stays local when the cloud is missing.
  }
}

/** One app_open per JS process, including when nobody is signed in. */
export function noteAppOpen(): Promise<void> {
  if (opening) return opening;
  opening = track('app_open', { platform: Platform.OS });
  return opening;
}

/** Upsert the rider and bump last_seen. FTP is copied from this phone. */
export async function syncProfile(user: AuthUser): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase || !user.id) return;
    const settings = await loadSettings();
    const ftp = Math.round(settings.ftpWatts);
    const displayName = user.name ? user.name.slice(0, 80) : null;
    const row: {
      id: string;
      display_name: string | null;
      last_seen_at: string;
      ftp_watts?: number;
    } = {
      id: user.id,
      display_name: displayName,
      last_seen_at: new Date().toISOString(),
    };
    if (ftp >= 50 && ftp <= 600) row.ftp_watts = ftp;
    await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  } catch {
    // Local settings still ride.
  }
}
