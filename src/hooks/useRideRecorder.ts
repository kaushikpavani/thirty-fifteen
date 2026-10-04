import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { buildRideRecord, MIN_SAVE_MS } from '../logic/rideRecord';
import type { RideSample } from '../logic/rideSummary';
import { checkpointRide } from '../storage/history';
import { createId } from '../storage/id';
import { CHECKPOINT_EVERY_MS } from '../storage/rideCheckpoint';
import type { NewWorkoutRecord, PhaseKind, RideSummary, WorkoutSettings } from '../types';
import type { EngineState } from './useWorkoutEngine';

const SAMPLE_MS = 1000;
const MAX_SAMPLES = 4000;

type Keyed<T> = { startedAt: number | null; value: T };

function forRide<T>(keyed: Keyed<T>, startedAt: number | null, empty: T): T {
  return keyed.startedAt === startedAt ? keyed.value : empty;
}

/**
 * Samples live power and heart rate once a second while the clock runs, and
 * saves the ride exactly once — phone first, cloud after (HistoryContext).
 * While the ride runs it also writes a checkpoint every few seconds, so a
 * dead battery, a crash or iOS closing the app can't lose the ride.
 * Everything the screen draws is state keyed to this ride's start, so a new
 * ride never shows the last one's numbers.
 */
export function useRideRecorder(args: {
  state: EngineState;
  settings: WorkoutSettings;
  watts: number | null;
  bpm: number | null;
  addSession: (input: NewWorkoutRecord, id?: string) => Promise<void>;
}) {
  const { state, settings, watts, bpm, addSession } = args;
  const kind: PhaseKind = state.segment?.kind ?? 'warmup';
  const samples = useRef<RideSample[]>([]);
  const savedFor = useRef<number | null>(null);
  /** One id per ride, shared by every checkpoint and the final save, so they are always the same ride. */
  const rideId = useRef<{ startedAt: number | null; id: string }>({ startedAt: null, id: '' });
  const latest = useRef({ elapsedMs: 0, kind, watts, bpm, startedAt: state.startedAt, workout: state.workout, settings });
  const [summary, setSummary] = useState<Keyed<RideSummary | null>>({ startedAt: null, value: null });
  const [hard, setHard] = useState<Keyed<{ sum: number; count: number }>>({ startedAt: null, value: { sum: 0, count: 0 } });

  useLayoutEffect(() => {
    latest.current = { elapsedMs: state.elapsedMs, kind, watts, bpm, startedAt: state.startedAt, workout: state.workout, settings };
  });

  useEffect(() => {
    samples.current = [];
  }, [state.startedAt]);

  const idFor = (startedAt: number): string => {
    if (rideId.current.startedAt !== startedAt) rideId.current = { startedAt, id: createId() };
    return rideId.current.id;
  };

  /** Write the ride as it stands. Skipped once the ride has been saved for real. */
  const checkpoint = useCallback(() => {
    const now = latest.current;
    if (now.startedAt == null || savedFor.current === now.startedAt || now.elapsedMs < MIN_SAVE_MS) return;
    try {
      const record = buildRideRecord({
        startedAt: now.startedAt,
        endedAt: Date.now(),
        elapsedMs: now.elapsedMs,
        completed: false,
        workout: now.workout,
        settings: now.settings,
        samples: samples.current,
      });
      void checkpointRide({ ...record, id: idFor(now.startedAt) });
    } catch {
      // Never let a checkpoint disturb the ride.
    }
  }, []);

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
    const saver = setInterval(checkpoint, CHECKPOINT_EVERY_MS);
    return () => {
      clearInterval(id);
      clearInterval(saver);
      // Pausing or leaving the running state: write what we have.
      checkpoint();
    };
  }, [state.status, state.startedAt, checkpoint]);

  // Going to the background is the last moment the app is sure to run: write then too.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') checkpoint();
    });
    return () => sub.remove();
  }, [checkpoint]);

  const record = useCallback(
    (completed: boolean) => {
      const startedAt = state.startedAt;
      if (!startedAt || savedFor.current === startedAt) return;
      if (!completed && state.elapsedMs < MIN_SAVE_MS) return;
      savedFor.current = startedAt;
      const built = buildRideRecord({
        startedAt,
        endedAt: Date.now(),
        elapsedMs: state.elapsedMs,
        completed,
        workout: state.workout,
        settings,
        samples: samples.current,
      });
      setSummary({ startedAt, value: built.summary ?? null });
      void addSession(built, idFor(startedAt));
    },
    [addSession, settings, state.elapsedMs, state.startedAt, state.workout],
  );

  const hardNow = forRide(hard, state.startedAt, { sum: 0, count: 0 });
  return {
    record,
    summary: forRide(summary, state.startedAt, null),
    hardAvg: hardNow.count > 0 ? Math.round(hardNow.sum / hardNow.count) : null,
  };
}
