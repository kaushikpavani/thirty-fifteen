import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { track } from '../storage/cloud';
import { deleteWorkoutHistory } from '../storage/deletion';
import type { CloudAttempt } from '../storage/deletionState';
import { loadDeletionState } from '../storage/deletionStore';
import { loadHistory, pullAndMerge, pushSession, saveHistory, withId } from '../storage/history';
import { safeMergedSessions, sessionsAfterWatermark } from '../storage/merge';
import type { NewWorkoutRecord, WorkoutRecord } from '../types';

type HistoryContextValue = {
  ready: boolean;
  sessions: WorkoutRecord[];
  cloudNote: string | null;
  addSession: (input: NewWorkoutRecord) => Promise<void>;
  /** Clears the on-screen list immediately, then the cloud copy when signed in. */
  clearSessions: () => Promise<CloudAttempt>;
};

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<WorkoutRecord[]>([]);
  const [cloudNote, setCloudNote] = useState<string | null>(null);
  const sessionsRef = useRef<WorkoutRecord[]>([]);
  const generation = useRef(0);
  const userId = auth.user?.id ?? null;

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    if (!auth.ready) return;
    let cancelled = false;
    void (async () => {
      const local = sessionsAfterWatermark(await loadHistory(), (await loadDeletionState()).historyDeletedThrough);
      if (cancelled) return;
      sessionsRef.current = local;
      setSessions(local);
      setReady(true);
      if (!userId) {
        setCloudNote(null);
        return;
      }
      const gen = generation.current;
      const merged = await pullAndMerge(sessionsRef.current);
      if (cancelled || generation.current !== gen) return;
      const visible = safeMergedSessions(
        local,
        sessionsAfterWatermark(merged.sessions, (await loadDeletionState()).historyDeletedThrough),
      );
      if (cancelled || generation.current !== gen) return;
      sessionsRef.current = visible;
      setSessions(visible);
      setCloudNote(merged.note);
      await saveHistory(visible);
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.ready, userId]);

  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const gen = generation.current;
      const before = sessionsRef.current;
      void pullAndMerge(before).then(async (merged) => {
        if (generation.current !== gen) return;
        const visible = safeMergedSessions(
          before,
          sessionsAfterWatermark(merged.sessions, (await loadDeletionState()).historyDeletedThrough),
        );
        if (generation.current !== gen) return;
        sessionsRef.current = visible;
        setSessions(visible);
        setCloudNote(merged.note);
        await saveHistory(visible);
      });
    });
    return () => sub.remove();
  }, [userId]);

  const addSession = useCallback(async (input: NewWorkoutRecord) => {
    const record = withId(input);
    const next = [record, ...sessionsRef.current].slice(0, 200);
    sessionsRef.current = next;
    setSessions(next);
    await saveHistory(next);
    void track('workout_finish', {
      completed: record.completed,
      completion_pct: record.completionPct,
      duration_ms: record.durationMs,
      planned_duration_ms: record.plannedDurationMs,
      ftp_watts: record.ftpWatts,
      hard_watts: record.hardWatts,
      easy_watts: record.easyWatts,
    });
    void pushSession(record).then((note) => {
      if (note) setCloudNote(note);
    });
  }, []);

  const clearSessions = useCallback(async () => {
    generation.current += 1;
    sessionsRef.current = [];
    setSessions([]);
    setCloudNote(null);
    return deleteWorkoutHistory();
  }, []);

  const value = useMemo(
    () => ({ ready, sessions, cloudNote, addSession, clearSessions }),
    [ready, sessions, cloudNote, addSession, clearSessions],
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory must be used inside HistoryProvider');
  return ctx;
}
