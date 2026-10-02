import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { track } from '../storage/cloud';
import { deleteWorkoutHistory } from '../storage/deletion';
import type { CloudAttempt } from '../storage/deletionState';
import { loadDeletionState } from '../storage/deletionStore';
import { deletedRideIds, deleteRide, readRides, saveRides, syncRides, withId } from '../storage/history';
import { sessionsAfterWatermark } from '../storage/merge';
import { addDownloaded, backupLine, type BackupState } from '../storage/rideSync';
import type { NewWorkoutRecord, WorkoutRecord } from '../types';

type HistoryContextValue = {
  ready: boolean;
  sessions: WorkoutRecord[];
  /** Where the rides are: on this iPhone only, backing up, backed up, or waiting. */
  backup: BackupState;
  /** backupLine(backup), ready to show. */
  cloudNote: string | null;
  addSession: (input: NewWorkoutRecord) => Promise<void>;
  /** Clears the on-screen list immediately, then the cloud copy when signed in. */
  clearSessions: () => Promise<CloudAttempt>;
  /** Deletes one ride from this iPhone, and from the cloud when signed in. False if it couldn't be deleted. */
  deleteSession: (id: string) => Promise<boolean>;
};

type SyncStatus = { kind: 'idle' | 'syncing' | 'backed-up' } | { kind: 'pending'; pending: number; reason: 'offline' | 'error' };

const HistoryContext = createContext<HistoryContextValue | null>(null);

/**
 * Rides only ever get added to what this provider shows. A read, a sync, a
 * sign-in or a sign-out can bring rides in; only the rider's own deletes
 * (clearSessions, deleteSession) take them out.
 */
export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<WorkoutRecord[]>([]);
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' });
  const sessionsRef = useRef<WorkoutRecord[]>([]);
  const generation = useRef(0);
  const syncing = useRef<Promise<void> | null>(null);
  const syncAgain = useRef(false);
  /** Rides that are on screen but whose storage write failed. Retried on foreground. */
  const unsaved = useRef<WorkoutRecord[]>([]);
  const userId = auth.user?.id ?? null;
  const userIdRef = useRef(userId);
  useLayoutEffect(() => {
    userIdRef.current = userId;
  });

  const show = useCallback((next: WorkoutRecord[]) => {
    sessionsRef.current = next;
    setSessions(next);
  }, []);

  const runSync = useCallback(() => {
    if (!userIdRef.current) return;
    if (syncing.current) {
      syncAgain.current = true;
      return;
    }
    const gen = generation.current;
    syncing.current = (async () => {
      do {
        syncAgain.current = false;
        setStatus((prev) => (prev.kind === 'backed-up' ? prev : { kind: 'syncing' }));
        const result = await syncRides(sessionsRef.current);
        if (generation.current !== gen) return;
        if (result.kind === 'signed-out') {
          setStatus({ kind: 'idle' });
          return;
        }
        if (result.downloaded.length) show(addDownloaded(sessionsRef.current, result.downloaded));
        setStatus(
          result.pending.length
            ? { kind: 'pending', pending: result.pending.length, reason: result.reason ?? 'error' }
            : { kind: 'backed-up' },
        );
      } while (syncAgain.current);
    })().finally(() => {
      syncing.current = null;
    });
  }, [show]);

  useEffect(() => {
    if (!auth.ready) return;
    let cancelled = false;
    void (async () => {
      let read = await readRides();
      if (!read.ok) {
        const again = await readRides();
        if (again.rides.length >= read.rides.length) read = again;
      }
      const cutoff = (await loadDeletionState()).historyDeletedThrough;
      const deleted = await deletedRideIds();
      if (cancelled) return;
      // Union with what's already on screen: a re-read (sign-in, sign-out)
      // can add rides but never take any away.
      show(
        addDownloaded(sessionsAfterWatermark(read.rides, cutoff), sessionsRef.current).filter((ride) => !deleted.has(ride.id)),
      );
      setReady(true);
      setStatus({ kind: 'idle' });
      if (userId) runSync();
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.ready, userId, runSync, show]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const retry = unsaved.current;
      if (retry.length) {
        void saveRides(retry).then((ok) => {
          if (ok) unsaved.current = unsaved.current.filter((ride) => !retry.includes(ride));
        });
      }
      runSync();
    });
    return () => sub.remove();
  }, [runSync]);

  const addSession = useCallback(
    async (input: NewWorkoutRecord) => {
      const record = withId(input);
      show([record, ...sessionsRef.current.filter((ride) => ride.id !== record.id)]);
      // Save this ride on its own key first; nothing else on disk is touched.
      if (!(await saveRides([record]))) unsaved.current = [...unsaved.current, record];
      void track('workout_finish', {
        completed: record.completed,
        completion_pct: record.completionPct,
        duration_ms: record.durationMs,
        planned_duration_ms: record.plannedDurationMs,
        ftp_watts: record.ftpWatts,
        hard_watts: record.hardWatts,
        easy_watts: record.easyWatts,
      });
      runSync();
    },
    [runSync, show],
  );

  const clearSessions = useCallback(async () => {
    generation.current += 1;
    unsaved.current = [];
    show([]);
    setStatus({ kind: 'idle' });
    return deleteWorkoutHistory();
  }, [show]);

  const deleteSession = useCallback(
    async (id: string) => {
      // Wait for any sync in flight so it can't re-add the ride from a stale snapshot.
      await syncing.current?.catch(() => undefined);
      if (!(await deleteRide(id))) return false;
      unsaved.current = unsaved.current.filter((ride) => ride.id !== id);
      show(sessionsRef.current.filter((ride) => ride.id !== id));
      runSync();
      return true;
    },
    [runSync, show],
  );

  const backup: BackupState = useMemo(() => {
    const total = sessions.length;
    if (!userId) return { kind: 'signed-out', total };
    if (status.kind === 'pending') return { kind: 'pending', total, pending: status.pending, reason: status.reason };
    if (status.kind === 'backed-up') return { kind: 'backed-up', total };
    return { kind: 'syncing', total };
  }, [sessions.length, userId, status]);

  const value = useMemo(
    () => ({ ready, sessions, backup, cloudNote: backupLine(backup), addSession, clearSessions, deleteSession }),
    [ready, sessions, backup, addSession, clearSessions, deleteSession],
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory must be used inside HistoryProvider');
  return ctx;
}
