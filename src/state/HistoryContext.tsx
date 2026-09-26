import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { track } from '../storage/cloud';
import { loadHistory, pullAndMerge, pushSession, saveHistory, withId } from '../storage/history';
import type { NewWorkoutRecord, WorkoutRecord } from '../types';

type HistoryContextValue = {
  ready: boolean;
  sessions: WorkoutRecord[];
  cloudNote: string | null;
  addSession: (input: NewWorkoutRecord) => Promise<void>;
};

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<WorkoutRecord[]>([]);
  const [cloudNote, setCloudNote] = useState<string | null>(null);
  const sessionsRef = useRef<WorkoutRecord[]>([]);
  const userId = auth.user?.id ?? null;

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    if (!auth.ready) return;
    let cancelled = false;
    void (async () => {
      const local = await loadHistory();
      if (cancelled) return;
      sessionsRef.current = local;
      setSessions(local);
      setReady(true);
      if (!userId) {
        setCloudNote(null);
        return;
      }
      const merged = await pullAndMerge(sessionsRef.current);
      if (cancelled) return;
      sessionsRef.current = merged.sessions;
      setSessions(merged.sessions);
      setCloudNote(merged.note);
      await saveHistory(merged.sessions);
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.ready, userId]);

  const addSession = useCallback(async (input: NewWorkoutRecord) => {
    const record = withId(input);
    const next = [record, ...sessionsRef.current].slice(0, 200);
    sessionsRef.current = next;
    setSessions(next);
    await saveHistory(next);
    const note = await pushSession(record);
    if (note) setCloudNote(note);
    void track('workout_finish', {
      completed: record.completed,
      completion_pct: record.completionPct,
      duration_ms: record.durationMs,
      planned_duration_ms: record.plannedDurationMs,
      ftp_watts: record.ftpWatts,
      hard_watts: record.hardWatts,
      easy_watts: record.easyWatts,
    });
  }, []);

  const value = useMemo(
    () => ({ ready, sessions, cloudNote, addSession }),
    [ready, sessions, cloudNote, addSession],
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory must be used inside HistoryProvider');
  return ctx;
}
