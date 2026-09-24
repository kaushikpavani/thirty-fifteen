import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { initAudio, playBeep, speak, stopSpeech } from '../audio/cues';
import type { BuiltWorkout, Segment, TimerStatus, WorkoutSettings } from '../types';
import { buildWorkout } from '../workout/builder';

const TICK_MS = 100;

export interface EngineState {
  status: TimerStatus;
  elapsedMs: number;
  segmentIndex: number;
  segment: Segment | null;
  remainingInSegmentMs: number;
  progress01: number;
  nextSegment: Segment | null;
  workout: BuiltWorkout;
}

export function useWorkoutEngine(settings: WorkoutSettings) {
  const workout = useMemo(() => buildWorkout(settings), [settings]);
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [segmentIndex, setSegmentIndex] = useState(0);

  const statusRef = useRef(status);
  const elapsedRef = useRef(0);
  const anchorWallRef = useRef<number | null>(null);
  const pausedAccumRef = useRef(0);
  const firedStartRef = useRef<Set<string>>(new Set());
  const firedEndRef = useRef<Set<string>>(new Set());
  const settingsRef = useRef(settings);
  const workoutRef = useRef(workout);

  statusRef.current = status;
  settingsRef.current = settings;
  workoutRef.current = workout;

  const resolvePosition = useCallback((elapsed: number) => {
    const segs = workoutRef.current.segments;
    let acc = 0;
    for (let i = 0; i < segs.length; i++) {
      const end = acc + segs[i].durationMs;
      if (elapsed < end) {
        return {
          index: i,
          segment: segs[i],
          remaining: end - elapsed,
          next: segs[i + 1] ?? null,
        };
      }
      acc = end;
    }
    const last = segs[segs.length - 1] ?? null;
    return { index: Math.max(0, segs.length - 1), segment: last, remaining: 0, next: null };
  }, []);

  const fireCuesFor = useCallback((elapsed: number) => {
    const s = settingsRef.current;
    const segs = workoutRef.current.segments;
    const lead = s.cueLeadMs ?? 800;
    let acc = 0;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const start = acc;
      const end = acc + seg.durationMs;

      // Start cue shortly after segment begins
      if (elapsed >= start && elapsed < start + 400) {
        const key = `start:${seg.id}`;
        if (!firedStartRef.current.has(key)) {
          firedStartRef.current.add(key);
          const beepKind =
            seg.kind === 'hard' || seg.kind === 'accel'
              ? 'go'
              : seg.kind === 'easy' || seg.kind === 'set_rest' || seg.kind === 'cooldown'
                ? 'easy'
                : 'warn';
          void playBeep(s, beepKind);
          if (seg.startCue) speak(seg.startCue, s);
          if (s.hapticsEnabled) {
            void Haptics.impactAsync(
              seg.kind === 'hard' || seg.kind === 'accel'
                ? Haptics.ImpactFeedbackStyle.Heavy
                : Haptics.ImpactFeedbackStyle.Medium,
            );
          }
        }
      }

      // End / next cue fires a beat early
      const cueAt = end - lead;
      if (elapsed >= cueAt && elapsed < end) {
        const key = `end:${seg.id}`;
        if (!firedEndRef.current.has(key)) {
          firedEndRef.current.add(key);
          void playBeep(s, 'warn');
          if (seg.endCue) speak(seg.endCue, s);
          if (s.hapticsEnabled) {
            void Haptics.selectionAsync();
          }
        }
      }

      acc = end;
    }

    if (elapsed >= workoutRef.current.totalMs) {
      const key = 'done';
      if (!firedEndRef.current.has(key)) {
        firedEndRef.current.add(key);
        void playBeep(s, 'done');
        speak('Workout complete. Nice session.', s);
        if (s.hapticsEnabled) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    }
  }, []);

  useEffect(() => {
    void initAudio();
  }, []);

  useEffect(() => {
    if (status !== 'running') return;

    const id = setInterval(() => {
      if (statusRef.current !== 'running' || anchorWallRef.current == null) return;
      const wall = Date.now() - anchorWallRef.current + pausedAccumRef.current;
      elapsedRef.current = wall;
      setElapsedMs(wall);

      const pos = resolvePosition(wall);
      setSegmentIndex(pos.index);
      fireCuesFor(wall);

      if (wall >= workoutRef.current.totalMs) {
        setStatus('finished');
        setElapsedMs(workoutRef.current.totalMs);
        void deactivateKeepAwake('workout');
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [status, resolvePosition, fireCuesFor]);

  const start = useCallback(async () => {
    firedStartRef.current = new Set();
    firedEndRef.current = new Set();
    pausedAccumRef.current = 0;
    elapsedRef.current = 0;
    setElapsedMs(0);
    setSegmentIndex(0);
    anchorWallRef.current = Date.now();
    setStatus('running');
    try {
      await activateKeepAwakeAsync('workout');
    } catch {
      // ignore
    }
    await initAudio();
  }, []);

  const pause = useCallback(() => {
    if (statusRef.current !== 'running' || anchorWallRef.current == null) return;
    const wall = Date.now() - anchorWallRef.current + pausedAccumRef.current;
    pausedAccumRef.current = wall;
    elapsedRef.current = wall;
    setElapsedMs(wall);
    anchorWallRef.current = null;
    setStatus('paused');
    stopSpeech();
  }, []);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    anchorWallRef.current = Date.now();
    setStatus('running');
  }, []);

  const stop = useCallback(() => {
    stopSpeech();
    anchorWallRef.current = null;
    pausedAccumRef.current = 0;
    elapsedRef.current = 0;
    setElapsedMs(0);
    setSegmentIndex(0);
    setStatus('idle');
    firedStartRef.current = new Set();
    firedEndRef.current = new Set();
    void deactivateKeepAwake('workout');
  }, []);

  const pos = resolvePosition(elapsedMs);
  const progress01 =
    workout.totalMs > 0 ? Math.min(1, elapsedMs / workout.totalMs) : 0;

  const state: EngineState = {
    status,
    elapsedMs,
    segmentIndex: pos.index,
    segment: status === 'idle' ? null : pos.segment,
    remainingInSegmentMs: status === 'idle' ? 0 : pos.remaining,
    progress01: status === 'idle' ? 0 : progress01,
    nextSegment: status === 'idle' ? null : pos.next,
    workout,
  };

  return { state, start, pause, resume, stop };
}
