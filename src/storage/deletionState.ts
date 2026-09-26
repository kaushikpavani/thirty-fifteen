/**
 * Durable cloud-delete bookkeeping. The phone applies local wipes immediately.
 * These jobs are what a later flush sends. A failed flush leaves the job in place.
 */

export type CloudJobKind = 'account' | 'device';

export type CloudJob = {
  id: string;
  kind: CloudJobKind;
  createdAt: string;
  deviceId: string | null;
};

export type DeletionState = {
  jobs: CloudJob[];
  /** Sessions with endedAt at or before this instant were wiped on this phone. */
  historyDeletedThrough: string | null;
  /**
   * Cloud session deletes still owed. Two successes heal a request that was
   * already on the wire when the rider hit delete.
   */
  sessionDeletesLeft: number;
};

export const EMPTY_DELETION: DeletionState = {
  jobs: [],
  historyDeletedThrough: null,
  sessionDeletesLeft: 0,
};

export type CloudAttempt = 'skipped' | 'done' | 'queued';

function isJob(value: unknown): value is CloudJob {
  if (!value || typeof value !== 'object') return false;
  const job = value as Partial<CloudJob>;
  return (
    typeof job.id === 'string' &&
    (job.kind === 'account' || job.kind === 'device') &&
    typeof job.createdAt === 'string' &&
    (job.deviceId === null || typeof job.deviceId === 'string')
  );
}

export function parseDeletionState(value: unknown): DeletionState {
  if (!value || typeof value !== 'object') return { ...EMPTY_DELETION };
  const raw = value as Partial<DeletionState>;
  const jobs = Array.isArray(raw.jobs) ? raw.jobs.filter(isJob) : [];
  const through = typeof raw.historyDeletedThrough === 'string' ? raw.historyDeletedThrough : null;
  const left = typeof raw.sessionDeletesLeft === 'number' && raw.sessionDeletesLeft > 0 ? Math.floor(raw.sessionDeletesLeft) : 0;
  return {
    jobs,
    historyDeletedThrough: through,
    sessionDeletesLeft: left,
  };
}

/** Remember a history wipe. A newer cutoff replaces an older one and re-arms two cloud passes. */
export function markHistoryDeleted(state: DeletionState, at: string): DeletionState {
  const through = state.historyDeletedThrough && state.historyDeletedThrough > at ? state.historyDeletedThrough : at;
  return {
    ...state,
    historyDeletedThrough: through,
    sessionDeletesLeft: 2,
  };
}

export function noteSessionDeleteSuccess(state: DeletionState): DeletionState {
  return {
    ...state,
    sessionDeletesLeft: Math.max(0, state.sessionDeletesLeft - 1),
  };
}

/** One pending job per kind. A repeat replaces the previous job of that kind. */
export function enqueueCloudJob(state: DeletionState, job: CloudJob): DeletionState {
  return {
    ...state,
    jobs: [job, ...state.jobs.filter((item) => item.kind !== job.kind)].slice(0, 8),
  };
}

export function withoutJobs(state: DeletionState, kinds: readonly CloudJobKind[]): DeletionState {
  const drop = new Set(kinds);
  return {
    ...state,
    jobs: state.jobs.filter((job) => !drop.has(job.kind)),
  };
}

export function historyDeleteNote(cloud: CloudAttempt): string {
  if (cloud === 'done') return 'History cleared on this phone and in the cloud.';
  if (cloud === 'queued') {
    return 'History cleared on this phone. The cloud copy is still there and will be deleted on a later try.';
  }
  return 'History cleared on this phone.';
}

export function outboxClearNote(): string {
  return 'Queued notes and analytics on this phone were cleared. Notes already delivered stay in the cloud until you delete the account.';
}

export function settingsResetNote(): string {
  return 'Settings on this phone are back to the defaults.';
}

export function deviceEraseNote(cloud: CloudAttempt): string {
  if (cloud === 'done') return 'This phone was erased. The cloud install row was removed.';
  if (cloud === 'queued') {
    return 'This phone was erased. The cloud install row is still there and will be removed on a later try.';
  }
  return 'This phone was erased.';
}

export function accountDeleteNote(cloud: 'done' | 'queued' | 'unconfigured'): string {
  if (cloud === 'done') {
    return 'Cloud account data was deleted. You are signed out. Sessions that are still on this phone can upload again if you sign in later.';
  }
  if (cloud === 'unconfigured') return 'Cloud is not set up on this install, so there is no account to delete.';
  return 'You are still signed in. The cloud delete did not finish. Cloud data is still there until a later try.';
}
