import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  enterWorkoutAudio,
  initAudio,
  leaveWorkoutAudio,
  playBeep,
  playLadder,
  setCoachVoice,
  speakCue,
  stopSpeech,
  unlockRockyFromGesture,
} from '../audio/cues';
import { armMusicFromGesture, setMusicGenre, kickBed, pauseMusic, releaseDuck, setBedTransportHandler, stopMusic, syncMusic } from '../audio/music';
import { inSegmentSilence, ROCKY_DONE, ROCKY_GO, ROCKY_ROUND, WARMUP_ONE_LEFT } from '../audio/rocky';
import {
  BEEP_DUCK_MS,
  HARD_OPEN_DUCK_MS,
  ROUND_DUCK_MS,
  bedId,
  bedRate,
  boundaryChirp,
  isFirstHard,
  ladderDuckMs,
  ladderKeys,
  ladderTexture,
  varietySalt,
  type MusicBed,
} from '../audio/spirit';
import type { BuiltWorkout, Segment, TimerStatus, WorkoutSettings } from '../types';
import { buildWorkout } from '../workout/builder';
import { takeCue, type DueCue } from '../workout/cueCatchup';
import { reduceAppPresence } from '../workout/appPresence';
import { planCatchUp } from '../workout/playhead';
import { runningElapsed } from '../workout/wallClock';
import {
  restartTargetMs,
  rockyKeysToRearm,
  segmentStartMs,
  shortenTargetMs,
  skipTargetMs,
  warmupJumpMs,
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

/** Where an elapsed time falls in the ride. Pure; the render and the timers both use it. */
export function positionAt(segs: Segment[], elapsed: number) {
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const end = acc + segs[i].durationMs;
    if (elapsed < end) {
      return { index: i, segment: segs[i], remaining: end - elapsed, next: segs[i + 1] ?? null };
    }
    acc = end;
  }
  const last = segs[segs.length - 1] ?? null;
  return { index: Math.max(0, segs.length - 1), segment: last, remaining: 0, next: null };
}

export function useWorkoutEngine(settings: WorkoutSettings) {
  const workout = useMemo(() => buildWorkout(settings), [settings]);
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
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
  const startedAtRef = useRef<number | null>(null);
  const lastCueRef = useRef(0);

  // Timers and audio callbacks read the latest values through refs; sync them after each commit.
  useLayoutEffect(() => {
    statusRef.current = status;
    settingsRef.current = settings;
    workoutRef.current = workout;
  });

  const resolvePosition = useCallback((elapsed: number) => positionAt(workoutRef.current.segments, elapsed), []);

  const playDue = useCallback((cue: DueCue, salt: number) => {
    if (!takeCue(firedStartRef.current, firedRockyRef.current, cue)) return;
    const s = settingsRef.current;
    const segs = workoutRef.current.segments;
    if (cue.type === 'chirp') {
      if (s.hapticsEnabled) {
        const heavy = cue.kind === 'hard' || cue.kind === 'accel';
        void Haptics.impactAsync(
          heavy
            ? Haptics.ImpactFeedbackStyle.Heavy
            : cue.kind === 'easy'
              ? Haptics.ImpactFeedbackStyle.Light
              : Haptics.ImpactFeedbackStyle.Medium,
        );
        // Go is a double knock: you feel HARD start even with the phone in a bar mount.
        if (heavy) setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 110);
      }
      const chirp = boundaryChirp(cue.kind);
      if (chirp === 'go') {
        void playBeep(s, 'go', cue.kind === 'hard' ? HARD_OPEN_DUCK_MS : undefined);
        const goKey = `go:${cue.segmentId}`;
        const spokenGo = cue.kind === 'hard' && s.spokenCount;
        if ((isFirstHard(cue.index, segs) || spokenGo) && !firedRockyRef.current.has(goKey)) {
          firedRockyRef.current.add(goKey);
          speakCue({ key: 'go', line: ROCKY_GO, clip: 'go' }, s);
        }
      } else if (chirp === 'release') {
        void playBeep(s, 'easy', BEEP_DUCK_MS, 0.7);
      } else if (chirp === 'win') {
        void playBeep(s, 'win', ROUND_DUCK_MS);
        const roundKey = `round:${cue.segmentId}`;
        if (!firedRockyRef.current.has(roundKey)) {
          firedRockyRef.current.add(roundKey);
          speakCue({ key: roundKey, line: ROCKY_ROUND, clip: 'round0' }, s);
        }
      }
      return;
    }
    if (cue.type === 'remaining') {
      const word = cue.minutes === 1 ? 'One minute' : `${cue.minutes} minutes`;
      const line = cue.clip === 'warmup1left' ? WARMUP_ONE_LEFT : `${word} left.`;
      speakCue({ key: cue.key, line, clip: cue.clip }, s);
      return;
    }
    if (cue.type === 'warn') {
      if (s.hapticsEnabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void playBeep(s, 'warn', ladderDuckMs('three'));
      return;
    }
    if (cue.type === 'ladder') {
      if (s.hapticsEnabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // An acceleration is a short, different kind of effort from the main
      // HARD reps — a heads-up at T-3 ("quick hard, ten seconds") replaces
      // the plain count so the rider knows what is about to happen, not just
      // that something is. Two/one still count down normally underneath it.
      if (cue.nextKind === 'accel' && cue.step === 'three' && s.speechEnabled && s.coachVoice !== 'off') {
        speakCue({ key: `accel:${cue.segmentId}`, line: 'Quick hard. Ten seconds.', clip: 'quick10' }, s);
        void playBeep(s, 'rung3', ladderDuckMs('three'), 0.35);
        return;
      }
      const spoken = s.spokenCount && s.speechEnabled && s.coachVoice !== 'off';
      if (spoken) {
        // The coach counts; the tick stays underneath, softer, so the beat is still felt.
        const n = cue.step === 'three' ? 3 : cue.step === 'two' ? 2 : 1;
        speakCue({ key: `count:${n}`, line: ['One.', 'Two.', 'Three.'][n - 1]!, clip: `count${n}` }, s);
        void playBeep(s, (cue.step === 'three' ? 'rung3' : cue.step === 'two' ? 'rung2' : 'rung1'), ladderDuckMs(cue.step), 0.35);
        return;
      }
      void playLadder(s, cue.step, ladderTexture(cue.approach, salt), ladderDuckMs(cue.step));
      return;
    }
    speakCue(cue, s);
  }, []);

  const deliver = useCallback(
    (toMs: number, cues: DueCue[]) => {
      const salt = varietySalt(startedAtRef.current);
      const pos = resolvePosition(toMs);
      if (pos.segment && toMs < workoutRef.current.totalMs) {
        syncMusic(
          bedForSegment(pos.segment, salt),
          settingsRef.current.musicEnabled,
          bedRate(pos.segment.kind, salt),
          pos.segment.label,
        );
      }
      const elapsedIn = pos.segment ? pos.segment.durationMs - pos.remaining : 0;
      const silent = pos.segment ? inSegmentSilence(elapsedIn, pos.segment.durationMs) : false;
      if (silent) stopSpeech();
      for (const cue of cues) {
        if (cue.type === 'rocky' && silent) continue;
        playDue(cue, salt);
      }
    },
    [playDue, resolvePosition],
  );

  const finishRunning = useCallback(() => {
    if (statusRef.current === 'finished') return;
    statusRef.current = 'finished';
    const total = workoutRef.current.totalMs;
    lastCueRef.current = total;
    elapsedRef.current = total;
    pausedAccumRef.current = total;
    anchorWallRef.current = null;
    setElapsedMs(total);
    setStatus('finished');
    stopMusic();
    leaveWorkoutAudio();
    void deactivateKeepAwake('workout');
  }, []);

  const applyWall = useCallback(
    (wall: number) => {
      if (statusRef.current !== 'running') return;
      const plan = planCatchUp({
        segments: workoutRef.current.segments,
        fromMs: lastCueRef.current,
        wallMs: wall,
        totalMs: workoutRef.current.totalMs,
        firedClock: firedStartRef.current,
        firedRocky: firedRockyRef.current,
        salt: varietySalt(startedAtRef.current),
        fullLadder: settingsRef.current.spokenCount && settingsRef.current.speechEnabled && settingsRef.current.coachVoice !== 'off',
      });
      if (!plan.step.commit) return;
      const to = plan.step.toMs;
      lastCueRef.current = to;
      elapsedRef.current = to;
      setElapsedMs(to);
      if (plan.step.deliver) deliver(to, plan.cues);
      if (plan.step.finished) finishRunning();
    },
    [deliver, finishRunning],
  );

  useEffect(() => {
    void initAudio();
  }, []);

  useEffect(() => {
    if (status !== 'running') return;

    const sawBackground = { current: false };

    const id = setInterval(() => {
      if (statusRef.current !== 'running' || anchorWallRef.current == null) return;
      applyWall(runningElapsed(Date.now(), anchorWallRef.current, pausedAccumRef.current));
    }, TICK_MS);

    const sub = AppState.addEventListener('change', (next) => {
      const reduced = reduceAppPresence(
        { sawBackground: sawBackground.current },
        next,
        { running: statusRef.current === 'running', anchored: anchorWallRef.current != null },
      );
      sawBackground.current = reduced.state.sawBackground;
      if (reduced.effect === 'none') return;
      const anchor = anchorWallRef.current;
      if (anchor == null) return;
      applyWall(runningElapsed(Date.now(), anchor, pausedAccumRef.current));
      if (reduced.effect === 'snap') {
        kickBed();
        return;
      }
      void enterWorkoutAudio().then(() => {
        if (statusRef.current !== 'running') return;
        kickBed();
      });
    });

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [status, applyWall]);

  const start = useCallback(async () => {
    firedStartRef.current = new Set();
    firedRockyRef.current = new Set();
    pausedAccumRef.current = 0;
    elapsedRef.current = 0;
    lastCueRef.current = 0;
    armedRef.current = true;
    const started = Date.now();
    startedAtRef.current = started;
    setStartedAt(started);
    setElapsedMs(0);
    anchorWallRef.current = null;
    setCoachVoice(settingsRef.current);
    setMusicGenre(settingsRef.current.musicGenre);
    unlockRockyFromGesture();
    armMusicFromGesture(settingsRef.current.musicEnabled);
    try {
      await activateKeepAwakeAsync('workout');
    } catch {
      // ignore
    }
    await initAudio();
    await enterWorkoutAudio();
    anchorWallRef.current = Date.now();
    pausedAccumRef.current = 0;
    setStatus('running');
    const opening = workoutRef.current.segments[0];
    if (opening) {
      const salt = varietySalt(startedAtRef.current);
      syncMusic(
        bedForSegment(opening, salt),
        settingsRef.current.musicEnabled,
        bedRate(opening.kind, salt),
        opening.label,
      );
    }
  }, []);

  const pause = useCallback(() => {
    if (statusRef.current !== 'running' || anchorWallRef.current == null) return;
    const wall = runningElapsed(Date.now(), anchorWallRef.current, pausedAccumRef.current);
    statusRef.current = 'paused';
    pausedAccumRef.current = wall;
    elapsedRef.current = wall;
    // Close the cue cursor at the pause instant. Resume must not treat the
    // paused gap as a tick and replay a window that already ended.
    lastCueRef.current = wall;
    setElapsedMs(wall);
    anchorWallRef.current = null;
    setStatus('paused');
    leaveWorkoutAudio();
    stopSpeech(true);
    pauseMusic();
  }, []);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    statusRef.current = 'running';
    anchorWallRef.current = Date.now();
    void enterWorkoutAudio();
    setStatus('running');
    const current = resolvePosition(elapsedRef.current).segment;
    if (current) {
      const salt = varietySalt(startedAtRef.current);
      syncMusic(
        bedForSegment(current, salt),
        settingsRef.current.musicEnabled,
        bedRate(current.kind, salt),
        current.label,
      );
    }
  }, [resolvePosition]);

  useEffect(() => {
    setBedTransportHandler((intent) => {
      if (intent === 'pause') pause();
      if (intent === 'resume') resume();
    });
    return () => setBedTransportHandler(null);
  }, [pause, resume]);

  const seekTo = useCallback(
    (targetMs: number, rearmCurrent: boolean) => {
      if (statusRef.current !== 'running' && statusRef.current !== 'paused') return;
      const segs = workoutRef.current.segments;
      const total = workoutRef.current.totalMs;
      const current = resolvePosition(elapsedRef.current);
      stopSpeech(true);
      releaseDuck();

      if (rearmCurrent && current.segment) {
        firedStartRef.current.delete(`chirp:${current.segment.id}`);
        firedStartRef.current.delete(`warn:${current.segment.id}`);
        for (const key of ladderKeys(current.segment.id)) firedStartRef.current.delete(key);
        for (const key of rockyKeysToRearm(current.segment, segmentStartMs(segs, current.index))) {
          firedRockyRef.current.delete(key);
        }
      }

      const next = Math.max(0, Math.min(targetMs, total));
      if (next >= total) {
        if (!firedRockyRef.current.has('finish')) {
          firedRockyRef.current.add('finish');
          speakCue({ key: 'finish', line: ROCKY_DONE, clip: 'done' }, settingsRef.current);
        }
        statusRef.current = 'finished';
        lastCueRef.current = total;
        elapsedRef.current = total;
        pausedAccumRef.current = total;
        anchorWallRef.current = null;
        setElapsedMs(total);
        setStatus('finished');
        stopMusic();
        leaveWorkoutAudio();
        void deactivateKeepAwake('workout');
        return;
      }

      const landed = resolvePosition(next);

      lastCueRef.current = next;
      elapsedRef.current = next;
      pausedAccumRef.current = next;
      anchorWallRef.current = statusRef.current === 'running' ? Date.now() : null;
      setElapsedMs(next);
      if (statusRef.current === 'running' && landed.segment) {
        const salt = varietySalt(startedAtRef.current);
        syncMusic(bedForSegment(landed.segment, salt), settingsRef.current.musicEnabled, bedRate(landed.segment.kind, salt), landed.segment.label);
      }
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

  /** Warm-up only: halve what is left, or skip to just before the first HARD. */
  const jumpWarmup = useCallback(
    (mode: 'halve' | 'skip') => {
      const target = warmupJumpMs(workoutRef.current.segments, elapsedRef.current, mode);
      if (target == null) return false;
      seekTo(target, false);
      return true;
    },
    [seekTo],
  );

  const stop = useCallback(() => {
    statusRef.current = 'idle';
    stopSpeech(true);
    leaveWorkoutAudio();
    stopMusic();
    armedRef.current = false;
    anchorWallRef.current = null;
    pausedAccumRef.current = 0;
    elapsedRef.current = 0;
    lastCueRef.current = 0;
    setStartedAt(null);
    setElapsedMs(0);
    setStatus('idle');
    firedStartRef.current = new Set();
    firedRockyRef.current = new Set();
    startedAtRef.current = null;
    void deactivateKeepAwake('workout');
  }, []);

  const pos = positionAt(workout.segments, elapsedMs);
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

  return { state, start, pause, resume, stop, restartSegment, shortenSegment, skipSegment, jumpWarmup, armedRef };
}

function bedForSegment(seg: { kind: string }, salt: number): MusicBed {
  return bedId(seg.kind, salt);
}
