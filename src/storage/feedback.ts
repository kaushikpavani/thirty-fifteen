import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../auth/supabase';
import { ensureDevice, track } from './cloud';
import { clientColumnMissing, feedbackDeviceProblem, insertAccepted, trimOutbox, withoutSent } from './cloudRow';
import { createId } from './id';
import { createQueue } from './queue';

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

const noteWrites = createQueue();

async function saveOutbox(notes: FeedbackNote[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(trimOutbox(notes, 40)));
  } catch {
    // The in-memory send still returns queued or sent from what we could store.
  }
}

const SEND_WAIT_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function insertNote(note: FeedbackNote): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const deviceId = await ensureDevice();
  const send = async (row: Record<string, unknown>) => {
    const { error } = await supabase.from('app_feedback').insert(row);
    if (!error || insertAccepted(error.message)) return { ok: true, message: '' };
    return { ok: false, message: error.message };
  };

  let row: Record<string, unknown> = {
    body: note.body,
    user_id: note.userId,
    rider_name: note.riderName,
    platform: note.platform,
    app_version: note.appVersion,
    device_id: deviceId,
    client_id: note.id,
  };
  let result = await send(row);
  if (result.ok) return true;
  if (clientColumnMissing('client_id', result.message)) {
    const { client_id, ...rest } = row;
    void client_id;
    row = rest;
    result = await send(row);
    if (result.ok) return true;
  }
  if (!feedbackDeviceProblem(result.message)) return false;
  const { device_id, ...withoutDevice } = row;
  void device_id;
  result = await send(withoutDevice);
  return result.ok;
}

let flushingNotes: Promise<number> | null = null;
let notesNeedAnotherPass = false;

/** Send anything still sitting on the phone. Failures stay queued. */
export function flushFeedbackOutbox(): Promise<number> {
  if (flushingNotes) {
    notesNeedAnotherPass = true;
    return flushingNotes;
  }
  flushingNotes = flushFeedbackUnsafe().finally(() => {
    flushingNotes = null;
    if (!notesNeedAnotherPass) return;
    notesNeedAnotherPass = false;
    void flushFeedbackOutbox();
  });
  return flushingNotes;
}

async function flushFeedbackUnsafe(): Promise<number> {
  const queued = await noteWrites(() => loadOutbox());
  if (queued.length === 0) return 0;
  const sent = new Set<string>();
  for (const note of queued) {
    try {
      if (await insertNote(note)) sent.add(note.id);
    } catch {
      // Leave it queued.
    }
  }
  if (sent.size === 0) return 0;
  await noteWrites(async () => {
    const latest = await loadOutbox();
    await saveOutbox(withoutSent(latest, sent));
  });
  return sent.size;
}

/** Drop notes that have not left the phone. */
export async function clearFeedbackOutbox(): Promise<void> {
  await noteWrites(async () => {
    await saveOutbox([]);
  });
}

export async function submitFeedback(
  input: Omit<FeedbackNote, 'id' | 'createdAt'>,
): Promise<FeedbackDelivery> {
  const note: FeedbackNote = {
    ...input,
    id: createId(),
    createdAt: new Date().toISOString(),
  };
  await noteWrites(async () => {
    const queued = await loadOutbox();
    await saveOutbox([note, ...queued.filter((item) => item.id !== note.id)]);
  });
  const flush = flushFeedbackOutbox();
  const finished = await Promise.race([flush.then(() => true), delay(SEND_WAIT_MS).then(() => false)]);
  const left = finished ? await loadOutbox() : null;
  const delivery: FeedbackDelivery = left?.some((item) => item.id === note.id) === false ? 'sent' : 'queued';
  void track('feedback', { delivery });
  return delivery;
}
