/**
 * What a backup sync should do, decided without touching the network.
 *
 * Sync is additive in both directions: rides on the phone that the cloud
 * doesn't have are uploaded; rides in the cloud the phone doesn't have are
 * downloaded. Nothing in a sync ever removes a ride from the phone. The
 * only exception to "download what's missing" is a ride at or before the
 * rider's own history-delete cutoff, so a delete isn't undone by a sync.
 */
import type { WorkoutRecord } from '../types';

export type RemoteEntry = { id: string; endedAt: string };

function afterCutoff(endedAt: string, deletedThrough: string | null): boolean {
  if (!deletedThrough) return true;
  // Compare instants, not strings: the cloud formats timestamps as
  // "…+00:00" while the phone writes "…Z".
  return Date.parse(endedAt) > Date.parse(deletedThrough);
}

export function planSync(
  local: readonly WorkoutRecord[],
  remote: readonly RemoteEntry[],
  deletedThrough: string | null,
): { upload: WorkoutRecord[]; download: string[] } {
  const remoteIds = new Set(remote.map((entry) => entry.id));
  const localIds = new Set(local.map((ride) => ride.id));
  return {
    upload: local.filter((ride) => !remoteIds.has(ride.id) && afterCutoff(ride.endedAt, deletedThrough)),
    download: remote
      .filter((entry) => !localIds.has(entry.id) && afterCutoff(entry.endedAt, deletedThrough))
      .map((entry) => entry.id),
  };
}

/** Rides on the phone that are not yet confirmed in the cloud. */
export function pendingBackup(
  local: readonly WorkoutRecord[],
  cloudIds: ReadonlySet<string>,
  deletedThrough: string | null,
): WorkoutRecord[] {
  return local.filter((ride) => !cloudIds.has(ride.id) && afterCutoff(ride.endedAt, deletedThrough));
}

/**
 * Phone rides plus downloaded ones, deduped by id. Phone copies win: the
 * phone recorded the ride; the cloud only has a copy of it. Never drops a
 * phone ride.
 */
export function addDownloaded(local: readonly WorkoutRecord[], downloaded: readonly WorkoutRecord[]): WorkoutRecord[] {
  const ids = new Set(local.map((ride) => ride.id));
  const merged = [...local, ...downloaded.filter((ride) => !ids.has(ride.id))];
  return merged.sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Postgres timestamptz text → the ISO form the phone uses. */
export function toIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export type BackupState =
  | { kind: 'signed-out'; total: number }
  | { kind: 'syncing'; total: number }
  | { kind: 'backed-up'; total: number }
  | { kind: 'pending'; total: number; pending: number; reason: 'offline' | 'error' };

/** One line for the rider. Every state says where the rides are. */
export function backupLine(state: BackupState): string {
  const rides = (n: number) => (n === 1 ? '1 ride' : `${n} rides`);
  switch (state.kind) {
    case 'signed-out':
      return state.total === 0
        ? 'Rides save on this iPhone. Sign in to back them up.'
        : `${rides(state.total)} saved on this iPhone. Sign in to back them up.`;
    case 'syncing':
      return 'Backing up your rides…';
    case 'backed-up':
      return state.total === 0 ? 'Signed in. New rides back up automatically.' : `All ${rides(state.total)} backed up.`;
    case 'pending':
      return state.reason === 'offline'
        ? `${rides(state.pending)} waiting to back up. They're safe on this iPhone and will upload when you're online.`
        : `${rides(state.pending)} not backed up yet. They're safe on this iPhone; 30/15 will keep retrying.`;
  }
}
