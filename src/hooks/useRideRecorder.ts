import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { summarizeRide, type RideSample } from '../logic/rideSummary';
import type { NewWorkoutRecord, PhaseKind, RideSummary, WorkoutSettings } from '../types';
import type { EngineState } from './useWorkoutEngine';

const SAMPLE_MS = 1000;
const MAX_SAMPLES = 4000;
/** A ride shorter than this is a mis-tap, not a ride. */
const MIN_SAVE_MS = 5000;

type Keyed<T> = { startedAt: number | null; value: T };

function forRide<T>(keyed: Keyed<T>, startedAt: number | null, empty: T): T {
  return keyed.startedAt === startedAt ? keyed.value : empty;
}

/**
 * Samples live power and heart rate once a second while the clock runs, and
 * saves the ride exactly once — phone first, cloud after (HistoryContext).
 * Everything the screen draws is state keyed to this ride's start, so a new
 * ride never shows the last one's numbers.
 */
export function useRideRecorder(args: {
  state: EngineState;
  settings: WorkoutSettings;
  watts: number | null;
  bpm: number | null;
  addSession: (input: NewWorkoutRecord) => Promise<void>;
}) {
  const { state, settings, watts, bpm, addSession } = args;
  const kind: PhaseKind = state.segment?.kind ?? 'warmup';
  const samples = useRef<RideSample[]>([]);
  const savedFor = useRef<number | null>(null);
  const latest = useRef({ elapsedMs: 0, kind, watts, bpm, startedAt: state.startedAt });
  const [summary, setSummary] = useState<Keyed<RideSummary | null>>({ startedAt: null, value: null });
  const [hard, setHard] = useState<Keyed<{ sum: number; count: number }>>({ startedAt: null, value: { sum: 0, count: 0 } });

  useLayoutEffect(() => {
    latest.current = { elapsedMs: state.elapsedMs, kind, watts, bpm, startedAt: state.startedAt };
  });

  useEffect(() => {
    samples.current = [];
  }, [state.startedAt]);

  useEffect(() => {
    if (state.status !== 'running') return;
    const take = () => {
      const now = latest.current;
      samples.current.push({ atMs: now.elapsedMs, kind: now.kind, watts: now.watts, bpm: now.bpm });
      if (samples.current.length > MAX_SAMPLES) samples.current.shift();
      if (now.kind === 'hard' && now.watts != null) {
        const w = now.watts;
        setHard((prev) =>
          prev.startedAt === now.startedAt
            ? { startedAt: prev.startedAt, value: { sum: prev.value.sum + w, count: prev.value.count + 1 } }
            : { startedAt: now.startedAt, value: { sum: w, count: 1 } },
        );
      }
    };
    take();
    const id = setInterval(take, SAMPLE_MS);
    return () => clearInterval(id);
  }, [state.status, state.startedAt]);

  const record = useCallback(
    (completed: boolean) => {
      const startedAt = state.startedAt;
      if (!startedAt || savedFor.current === startedAt) return;
      if (!completed && state.elapsedMs < MIN_SAVE_MS) return;
      savedFor.current = startedAt;
      const total = state.workout.totalMs || 1;
      const elapsed = completed ? total : state.elapsedMs;
      const value = summarizeRide({
        segments: state.workout.segments,
        elapsedMs: elapsed,
        plannedSets: settings.sets,
        completed,
        samples: samples.current,
      });
      setSummary({ startedAt, value });
      void addSession({
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: elapsed,
        plannedDurationMs: total,
        ftpWatts: settings.ftpWatts,
        hardWatts: state.workout.hardWatts,
        easyWatts: state.workout.easyWatts,
        completed,
        completionPct: completed ? 100 : Math.min(99, Math.round((state.elapsedMs / total) * 100)),
        summary: value,
      });
    },
    [addSession, settings.ftpWatts, settings.sets, state.elapsedMs, state.startedAt, state.workout],
  );

  const hardNow = forRide(hard, state.startedAt, { sum: 0, count: 0 });
  return {
    record,
    summary: forRide(summary, state.startedAt, null),
    hardAvg: hardNow.count > 0 ? Math.round(hardNow.sum / hardNow.count) : null,
  };
}
