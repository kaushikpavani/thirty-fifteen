import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { initAudio, speakCue, stopSpeech, unlockRockyFromGesture } from '../audio/cues';
import { inSegmentSilence, ROCKY_FINISH, rockyCue } from '../audio/rocky';
import type { BuiltWorkout, Segment, TimerStatus, WorkoutSettings } from '../types';
import { buildWorkout } from '../workout/builder';
import {
  restartTargetMs,
  rockyKeysToRearm,
  segmentStartMs,
  shortenTargetMs,
  skipTargetMs,
} from '../workout/transport';

const TICK_MS = 100;

export interface EngineState {
  status: TimerStatus;
  elapsedMs: number;
  startedAt: number | null;
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
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const armedRef = useRef(false);

  const statusRef = useRef(status);
  const elapsedRef = useRef(0);
  const anchorWallRef = useRef<number | null>(null);
  const pausedAccumRef = useRef(0);
  const firedStartRef = useRef<Set<string>>(new Set());
  const firedRockyRef = useRef<Set<string>>(new Set());
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
    let acc = 0;
    let current: { seg: Segment; elapsedIn: number } | null = null;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const start = acc;
      const end = acc + seg.durationMs;
      if (elapsed >= start && elapsed < end) {
        current = { seg, elapsedIn: elapsed - start };
        break;
      }
      acc = end;
    }

    if (!current) return;

    if (current.elapsedIn < 400) {
      const key = `start:${current.seg.id}`;
      if (!firedStartRef.current.has(key)) {
        firedStartRef.current.add(key);
        if (s.hapticsEnabled) {
          void Haptics.impactAsync(
            current.seg.kind === 'hard' || current.seg.kind === 'accel'
              ? Haptics.ImpactFeedbackStyle.Heavy
              : Haptics.ImpactFeedbackStyle.Light,
          );
        }
      }
    }

    if (inSegmentSilence(current.elapsedIn, current.seg.durationMs)) {
      stopSpeech();
      return;
    }

    const cue = rockyCue({
      elapsedMs: elapsed,
      segments: segs,
      fired: firedRockyRef.current,
    });
    if (!cue || firedRockyRef.current.has(cue.key)) return;
    firedRockyRef.current.add(cue.key);
    speakCue(cue, s);
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
    firedRockyRef.current = new Set();
    pausedAccumRef.current = 0;
    elapsedRef.current = 0;
    armedRef.current = true;
    setStartedAt(Date.now());
    setElapsedMs(0);
    setSegmentIndex(0);
    anchorWallRef.current = null;
    unlockRockyFromGesture();
    try {
      await activateKeepAwakeAsync('workout');
    } catch {
      // ignore
    }
    await initAudio();
    anchorWallRef.current = Date.now();
    pausedAccumRef.current = 0;
    setStatus('running');
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

  const seekTo = useCallback(
    (targetMs: number, rearmCurrent: boolean) => {
      if (statusRef.current !== 'running' && statusRef.current !== 'paused') return;
      const segs = workoutRef.current.segments;
      const total = workoutRef.current.totalMs;
      const current = resolvePosition(elapsedRef.current);
      stopSpeech();

      if (rearmCurrent && current.segment) {
        firedStartRef.current.delete(`start:${current.segment.id}`);
        for (const key of rockyKeysToRearm(current.segment, segmentStartMs(segs, current.index))) {
          firedRockyRef.current.delete(key);
        }
      }

      const next = Math.max(0, Math.min(targetMs, total));
      if (next >= total) {
        if (!firedRockyRef.current.has('finish')) {
          firedRockyRef.current.add('finish');
          speakCue({ key: 'finish', line: ROCKY_FINISH }, settingsRef.current);
        }
        elapsedRef.current = total;
        pausedAccumRef.current = total;
        anchorWallRef.current = null;
        setElapsedMs(total);
        setSegmentIndex(Math.max(0, segs.length - 1));
        setStatus('finished');
        void deactivateKeepAwake('workout');
        return;
      }

      elapsedRef.current = next;
      pausedAccumRef.current = next;
      anchorWallRef.current = statusRef.current === 'running' ? Date.now() : null;
      setElapsedMs(next);
      setSegmentIndex(resolvePosition(next).index);
    },
    [resolvePosition],
  );

  const restartSegment = useCallback(() => {
    const segs = workoutRef.current.segments;
    const index = resolvePosition(elapsedRef.current).index;
    seekTo(restartTargetMs(segs, index), true);
  }, [resolvePosition, seekTo]);

  const shortenSegment = useCallback(() => {
    const segs = workoutRef.current.segments;
    const index = resolvePosition(elapsedRef.current).index;
    seekTo(shortenTargetMs(segs, index), false);
  }, [resolvePosition, seekTo]);

  const skipSegment = useCallback(() => {
    const segs = workoutRef.current.segments;
    const index = resolvePosition(elapsedRef.current).index;
    seekTo(skipTargetMs(segs, index), false);
  }, [resolvePosition, seekTo]);

  const stop = useCallback(() => {
    stopSpeech();
    armedRef.current = false;
    anchorWallRef.current = null;
    pausedAccumRef.current = 0;
    elapsedRef.current = 0;
    setStartedAt(null);
    setElapsedMs(0);
    setSegmentIndex(0);
    setStatus('idle');
    firedStartRef.current = new Set();
    firedRockyRef.current = new Set();
    void deactivateKeepAwake('workout');
  }, []);

  const pos = resolvePosition(elapsedMs);
  const progress01 =
    workout.totalMs > 0 ? Math.min(1, elapsedMs / workout.totalMs) : 0;

  const state: EngineState = {
    status,
    elapsedMs,
    startedAt,
    segmentIndex: pos.index,
    segment: status === 'idle' ? null : pos.segment,
    remainingInSegmentMs: status === 'idle' ? 0 : pos.remaining,
    progress01: status === 'idle' ? 0 : progress01,
    nextSegment: status === 'idle' ? null : pos.next,
    workout,
  };

  return { state, start, pause, resume, stop, restartSegment, shortenSegment, skipSegment, armedRef };
}
