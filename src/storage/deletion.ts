/**
 * Local wipes happen here, before any network call. Cloud deletes are queued
 * and retried from `flushCloudDeletes`. A failure does not mean the cloud is gone.
 * Start, the clock, cues, and music do not call this module.
 */
import { isSupabaseConfigured } from '../auth/config';
import { loadCachedAuthUser } from '../auth/sessionCache';
import { getSupabase } from '../auth/supabase';
import { clearEventOutbox, localDeviceId, forgetDeviceId } from './cloud';
import {
  type CloudAttempt,
  enqueueCloudJob,
  markHistoryDeleted,
  noteSessionDeleteSuccess,
  withoutJobs,
} from './deletionState';
import { loadDeletionState, primeHistoryWipe, saveDeletionState } from './deletionStore';
import { clearFeedbackOutbox } from './feedback';
import { clearHistory } from './history';
import { createId } from './id';
import { saveLocalName } from './profile';
import { clearSavedPowerMeter } from './powerMeter';
import { clearStoredSettings } from './settings';

const ATTEMPT_MS = 4000;

export type FlushReport = {
  sessions: CloudAttempt;
  account: CloudAttempt;
  device: CloudAttempt;
};

type AccountDeletedListener = () => Promise<void> | void;

let accountDeletedListener: AccountDeletedListener | null = null;
let tail: Promise<void> = Promise.resolve();

/** Auth registers this so a finished account delete signs the rider out. */
export function onCloudAccountDeleted(listener: AccountDeletedListener): () => void {
  accountDeletedListener = listener;
  return () => {
    if (accountDeletedListener === listener) accountDeletedListener = null;
  };
}

function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(work).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function attemptRpc(name: string, args: Record<string, unknown>): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const result = await withTimeout(supabase.rpc(name, args), ATTEMPT_MS);
    return !result.error;
  } catch {
    return false;
  }
}

/**
 * Send queued cloud deletes. Never throws. Calls are serialized.
 * Local data is already gone when the rider asked; this only reports whether
 * the cloud copy moved.
 */
export function flushCloudDeletes(): Promise<FlushReport> {
  const run = tail.then(flushUnsafe, flushUnsafe);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function flushUnsafe(): Promise<FlushReport> {
  const report: FlushReport = { sessions: 'skipped', account: 'skipped', device: 'skipped' };
  try {
    const state = await loadDeletionState();
    const configured = isSupabaseConfigured();
    const user = configured ? await loadCachedAuthUser() : null;

    if (state.sessionDeletesLeft > 0 && state.historyDeletedThrough) {
      if (!configured || !user) {
        report.sessions = 'skipped';
      } else {
        const ok = await attemptRpc('delete_my_sessions', { p_ended_before: state.historyDeletedThrough });
        if (ok) {
          const latest = await loadDeletionState();
          await saveDeletionState(noteSessionDeleteSuccess(latest));
          report.sessions = 'done';
        } else {
          report.sessions = 'queued';
        }
      }
    }

    const accountJob = (await loadDeletionState()).jobs.find((job) => job.kind === 'account');
    if (accountJob) {
      if (!configured || !user) {
        report.account = 'queued';
      } else {
        const ok = await attemptRpc('delete_my_account', {});
        if (ok) {
          const latest = await loadDeletionState();
          await saveDeletionState(withoutJobs(latest, ['account']));
          report.account = 'done';
          // Do not await. Sign-out starts a sync, and this flush must finish first.
          void Promise.resolve(accountDeletedListener?.());
        } else {
          report.account = 'queued';
        }
      }
    }

    const deviceJob = (await loadDeletionState()).jobs.find((job) => job.kind === 'device');
    if (deviceJob?.deviceId) {
      if (!configured) {
        report.device = 'skipped';
      } else {
        const ok = await attemptRpc('delete_my_device', { p_id: deviceJob.deviceId });
        if (ok) {
          const latest = await loadDeletionState();
          await saveDeletionState(withoutJobs(latest, ['device']));
          report.device = 'done';
        } else {
          report.device = 'queued';
        }
      }
    }
  } catch {
    // Leave jobs where they are.
  }
  return report;
}

/** Clear workout history on this phone, then try the cloud copy if a rider is signed in. */
export async function deleteWorkoutHistory(): Promise<CloudAttempt> {
  const at = new Date().toISOString();
  primeHistoryWipe(at);
  const current = await loadDeletionState();
  await saveDeletionState(markHistoryDeleted(current, at));
  await clearHistory();
  const report = await flushCloudDeletes();
  return report.sessions;
}

/** Drop feedback and analytics that have not left the phone. */
export async function clearQueuedOutboxes(): Promise<void> {
  await clearFeedbackOutbox();
  await clearEventOutbox();
}

/**
 * Erase this install's local stores and queue removal of its device row.
 * Call `deleteWorkoutHistory` first when the history screen must update.
 */
export async function eraseThisDevice(): Promise<CloudAttempt> {
  const deviceId = await localDeviceId();
  const at = new Date().toISOString();
  primeHistoryWipe(at);
  const marked = await loadDeletionState();
  await saveDeletionState(markHistoryDeleted(marked, at));
  await clearHistory();
  await clearQueuedOutboxes();
  await saveLocalName(null);
  await clearStoredSettings();
  await clearSavedPowerMeter();
  await forgetDeviceId();
  if (deviceId && isSupabaseConfigured()) {
    const current = await loadDeletionState();
    await saveDeletionState(
      enqueueCloudJob(current, {
        id: createId(),
        kind: 'device',
        createdAt: new Date().toISOString(),
        deviceId,
      }),
    );
  }
  const report = await flushCloudDeletes();
  return report.device;
}

/**
 * Queue a full cloud wipe and try it now. Does not clear sessions stored on
 * the phone. Signs out only after the server accepts the delete.
 */
export async function requestAccountDelete(): Promise<'done' | 'queued' | 'unconfigured'> {
  if (!isSupabaseConfigured()) return 'unconfigured';
  const user = await loadCachedAuthUser();
  if (!user) return 'unconfigured';
  const current = await loadDeletionState();
  await saveDeletionState(
    enqueueCloudJob(current, {
      id: createId(),
      kind: 'account',
      createdAt: new Date().toISOString(),
      deviceId: null,
    }),
  );
  const report = await flushCloudDeletes();
  return report.account === 'done' ? 'done' : 'queued';
}
