import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../auth/supabase';
import { ensureDevice, track } from './cloud';
import { feedbackDeviceProblem } from './cloudRow';
import { createId } from './id';

const KEY = '@thirtyfifteen/feedback-outbox/v1';

export type FeedbackNote = {
  id: string;
  body: string;
  createdAt: string;
  userId: string | null;
  riderName: string | null;
  platform: string;
  appVersion: string | null;
};

export type FeedbackDelivery = 'sent' | 'queued';

function isNote(value: unknown): value is FeedbackNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as Partial<FeedbackNote>;
  return typeof note.id === 'string' && typeof note.body === 'string' && typeof note.createdAt === 'string';
}

async function loadOutbox(): Promise<FeedbackNote[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNote);
  } catch {
    return [];
  }
}

async function saveOutbox(notes: FeedbackNote[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(notes.slice(0, 40)));
  } catch {
    // ignore
  }
}

async function insertNote(note: FeedbackNote): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const deviceId = await ensureDevice();
  const row = {
    body: note.body,
    user_id: note.userId,
    rider_name: note.riderName,
    platform: note.platform,
    app_version: note.appVersion,
    device_id: deviceId,
  };
  const first = await supabase.from('app_feedback').insert(row);
  if (!first.error) return true;
  if (!feedbackDeviceProblem(first.error.message)) return false;
  const second = await supabase.from('app_feedback').insert({
    body: note.body,
    user_id: note.userId,
    rider_name: note.riderName,
    platform: note.platform,
    app_version: note.appVersion,
  });
  return !second.error;
}

/** Send anything still sitting on the phone. Failures stay queued. */
export async function flushFeedbackOutbox(): Promise<number> {
  const queued = await loadOutbox();
  if (queued.length === 0) return 0;
  const remaining: FeedbackNote[] = [];
  let sent = 0;
  for (const note of queued) {
    if (await insertNote(note)) sent += 1;
    else remaining.push(note);
  }
  await saveOutbox(remaining);
  return sent;
}

export async function submitFeedback(
  input: Omit<FeedbackNote, 'id' | 'createdAt'>,
): Promise<FeedbackDelivery> {
  const note: FeedbackNote = {
    ...input,
    id: createId(),
    createdAt: new Date().toISOString(),
  };
  if (await insertNote(note)) {
    void track('feedback', { delivery: 'sent' });
    void flushFeedbackOutbox();
    return 'sent';
  }
  const queued = await loadOutbox();
  await saveOutbox([note, ...queued]);
  void track('feedback', { delivery: 'queued' });
  return 'queued';
}
