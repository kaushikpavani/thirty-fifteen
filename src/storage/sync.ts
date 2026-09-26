import { loadCachedAuthUser } from '../auth/sessionCache';
import { flushEvents, syncProfile } from './cloud';
import { flushCloudDeletes } from './deletion';
import { flushFeedbackOutbox } from './feedback';

let flushing: Promise<void> | null = null;

/**
 * Best-effort cloud flush. Never throws. Callers must not wait on this for Start,
 * the clock, cues, music, or history.
 */
export function scheduleSync(): void {
  if (flushing) return;
  flushing = runSync().finally(() => {
    flushing = null;
  });
}

async function runSync(): Promise<void> {
  try {
    const deleted = await flushCloudDeletes();
    if (deleted.account === 'done') return;
    await flushEvents();
    await flushFeedbackOutbox();
    const user = await loadCachedAuthUser();
    if (user) await syncProfile(user);
  } catch {
    // Outboxes stay on the phone until a later try.
  }
}
