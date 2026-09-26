import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { loadCachedAuthUser } from '../auth/sessionCache';
import { getSupabase } from '../auth/supabase';
import type { AuthUser } from '../types';
import { isAnalyticsEvent, sanitizeEventProperties, type EventProperties } from './analytics';
import { clientColumnMissing, cloudDuplicate, feedbackDeviceProblem, trimOutbox, withoutSent } from './cloudRow';
import { createId, isInstallId } from './id';
import { profileWrite } from './profileWrite';
import { loadSettings } from './settings';

const DEVICE_KEY = '@thirtyfifteen/device_id/v1';
const EVENTS_KEY = '@thirtyfifteen/events-outbox/v1';
const EVENT_CAP = 200;

type QueuedEvent = {
  id: string;
  eventName: string;
  userId: string | null;
  deviceId: string | null;
  clientSessionId: string;
  properties: EventProperties;
  createdAt: string;
};

let clientSessionId: string | null = null;
let notedOpen = false;
let flushingEvents: Promise<void> | null = null;
let eventsNeedAnotherPass = false;

function sessionId(): string {
  if (!clientSessionId) clientSessionId = createId();
  return clientSessionId;
}

function isQueuedEvent(value: unknown): value is QueuedEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<QueuedEvent>;
  return typeof event.id === 'string' && typeof event.eventName === 'string' && typeof event.createdAt === 'string';
}

async function loadEvents(): Promise<QueuedEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueuedEvent);
  } catch {
    return [];
  }
}

async function saveEvents(events: QueuedEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(trimOutbox(events, EVENT_CAP)));
  } catch {
    // The ride still happened.
  }
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

/** Forget this install id. The next read creates a new one. Local only. */
export async function forgetDeviceId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEVICE_KEY);
  } catch {
    // The in-memory ride does not need the id.
  }
}

/**
 * Best-effort install row. Returns the id only when the cloud accepted it.
 * A miss leaves the local id in place and does not throw.
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

async function insertEvent(event: QueuedEvent, cloudDeviceId: string | null): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const send = async (row: Record<string, unknown>) => {
    const { error } = await supabase.from('app_events').insert(row);
    if (!error || cloudDuplicate(error.message)) return { ok: true, message: '' };
    return { ok: false, message: error.message };
  };

  let row: Record<string, unknown> = {
    event_name: event.eventName,
    user_id: event.userId,
    device_id: cloudDeviceId,
    client_session_id: event.clientSessionId,
    properties: sanitizeEventProperties(event.properties),
    created_at: event.createdAt,
    client_event_id: event.id,
  };

  let result = await send(row);
  if (result.ok) return true;
  if (clientColumnMissing('client_event_id', result.message)) {
    const { client_event_id, ...rest } = row;
    void client_event_id;
    row = rest;
    result = await send(row);
    if (result.ok) return true;
  }
  if (feedbackDeviceProblem(result.message)) {
    row = { ...row, device_id: null };
    result = await send(row);
    if (result.ok) return true;
  }
  if (row.user_id && /row-level security|42501/i.test(result.message)) {
    result = await send({ ...row, user_id: null, device_id: null });
  }
  return result.ok;
}

/** Send queued analytics. Failures stay on the phone. */
export function flushEvents(): Promise<void> {
  if (flushingEvents) {
    eventsNeedAnotherPass = true;
    return flushingEvents;
  }
  flushingEvents = flushEventsUnsafe().finally(() => {
    flushingEvents = null;
    if (!eventsNeedAnotherPass) return;
    eventsNeedAnotherPass = false;
    void flushEvents();
  });
  return flushingEvents;
}

async function flushEventsUnsafe(): Promise<void> {
  const queued = await loadEvents();
  if (queued.length === 0 || !getSupabase()) return;
  const cloudDeviceId = await ensureDevice();
  const sent = new Set<string>();
  for (const event of queued) {
    try {
      if (await insertEvent(event, cloudDeviceId)) sent.add(event.id);
    } catch {
      // Leave it queued.
    }
  }
  if (sent.size === 0) return;
  const latest = await loadEvents();
  await saveEvents(withoutSent(latest, sent));
}

/** Drop analytics that have not left the phone. */
export async function clearEventOutbox(): Promise<void> {
  await saveEvents([]);
}

/**
 * Remember an analytics event on the phone, then try to send it.
 * Resolves after the local write. The network attempt does not block the caller.
 */
export async function track(eventName: string, properties: EventProperties = {}): Promise<void> {
  if (!isAnalyticsEvent(eventName)) return;
  try {
    const cached = await loadCachedAuthUser();
    const event: QueuedEvent = {
      id: createId(),
      eventName,
      userId: cached?.id ?? null,
      deviceId: await localDeviceId(),
      clientSessionId: sessionId(),
      properties: sanitizeEventProperties(properties),
      createdAt: new Date().toISOString(),
    };
    const existing = await loadEvents();
    await saveEvents([event, ...existing.filter((item) => item.id !== event.id)]);
  } catch {
    return;
  }
  void flushEvents();
}

/** One app_open per JS process, including when nobody is signed in and the radio is off. */
export function noteAppOpen(): void {
  if (notedOpen) return;
  notedOpen = true;
  void track('app_open', { platform: Platform.OS });
}

/** Copy the phone's rider onto the profile. FTP on the phone stays the source of truth. */
export async function syncProfile(user: AuthUser): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase || !user.id) return;
    const settings = await loadSettings();
    const row = profileWrite(user, settings.ftpWatts, new Date().toISOString());
    await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  } catch {
    // Local settings still ride.
  }
}
