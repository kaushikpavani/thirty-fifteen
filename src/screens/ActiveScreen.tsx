import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoneSummary } from '../components/DoneSummary';
import { useHistory } from '../state/HistoryContext';
import { useHeartRate } from '../state/HeartRateContext';
import { usePowerMeter } from '../state/PowerMeterContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkout } from '../state/WorkoutContext';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { pauseResumeDrivers, pauseResumeSlots } from '../motion/animatedDriver';
import { colors, phaseLabel } from '../theme/colors';
import type { PhaseKind, RideSummary, Segment } from '../types';
import { formatClock } from '../workout/builder';
import { FINISH_SUBTITLE, FINISH_TITLE } from '../workout/craft';
import { summarizeRide, type RideSample } from '../logic/rideSummary';

const nativeMotion = Platform.OS !== 'web';
const pauseDrivers = pauseResumeDrivers(nativeMotion);

function fieldColors(kind: PhaseKind): [string, string] {
  switch (kind) {
    case 'hard':
    case 'accel':
      return ['#FF2D1A', '#B00008'];
    case 'easy':
      return ['#0E3C4C', '#071820'];
    case 'warmup':
      return ['#C56A28', '#3A1C10'];
    case 'cooldown':
      return ['#1A4E90', '#071018'];
    default:
      return ['#2C2C30', '#0C0C0E'];
  }
}

function badge(kind: PhaseKind, segment: Segment | null, sets: number): string {
  if (kind === 'warmup' || kind === 'accel') return 'WARM-UP';
  if (kind === 'cooldown') return 'COOL-DOWN';
  const label = phaseLabel(kind);
  if (segment?.setNumber) return `${label} · Set ${segment.setNumber} of ${sets}`;
  return label;
}

export function ActiveScreen() {
  const engine = useWorkout();
  const history = useHistory();
  const { settings } = useSettings();
  const meter = usePowerMeter();
  const heart = useHeartRate();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const savedRef = useRef<number | null>(null);
  const samplesRef = useRef<RideSample[]>([]);
  const summaryRef = useRef<RideSummary | null>(null);
  const elapsedRef = useRef(0);
  const kindRef = useRef<PhaseKind>('warmup');
  const wattsRef = useRef<number | null>(null);
  const bpmRef = useRef<number | null>(null);
  const [endArmed, setEndArmed] = useState(false);

  const { state } = engine;
  const seg = state.segment;
  const kind = seg?.kind ?? 'warmup';
  const duration = seg?.durationMs ?? 1;
  const remaining = state.remainingInSegmentMs;
  const short = duration <= 90_000;
  const clock = short ? String(Math.max(0, Math.ceil(remaining / 1000))) : formatClock(remaining);
  const paused = state.status === 'paused';
  const watts = meter.live?.watts ?? null;
  const bpm = heart.live?.bpm ?? null;
  elapsedRef.current = state.elapsedMs;
  kindRef.current = kind;
  wattsRef.current = watts;
  bpmRef.current = bpm;

  useEffect(() => {
    if (!engine.armedRef.current) router.replace('/home');
  }, [engine.armedRef]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (state.status === 'idle') {
      samplesRef.current = [];
      summaryRef.current = null;
    }
  }, [state.status, state.startedAt]);

  useEffect(() => {
    if (state.status !== 'running') return;
    const take = () => {
      samplesRef.current.push({
        atMs: elapsedRef.current,
        kind: kindRef.current,
        watts: wattsRef.current,
        bpm: bpmRef.current,
      });
      if (samplesRef.current.length > 4000) samplesRef.current.shift();
    };
    take();
    const id = setInterval(take, 1000);
    return () => clearInterval(id);
  }, [state.status, state.startedAt]);

  const buildSummary = (completed: boolean, elapsedMs: number): RideSummary =>
    summarizeRide({
      segments: state.workout.segments,
      elapsedMs,
      plannedSets: settings.sets,
      completed,
      samples: samplesRef.current,
    });

  const record = (completed: boolean) => {
    const startedAt = state.startedAt;
    if (!startedAt || savedRef.current === startedAt) return;
    if (!completed && state.elapsedMs < 5000) return;
    savedRef.current = startedAt;
    const total = state.workout.totalMs || 1;
    const elapsed = completed ? total : state.elapsedMs;
    const summary = buildSummary(completed, elapsed);
    summaryRef.current = summary;
    void history.addSession({
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      durationMs: elapsed,
      plannedDurationMs: total,
      ftpWatts: settings.ftpWatts,
      hardWatts: state.workout.hardWatts,
      easyWatts: state.workout.easyWatts,
      completed,
      completionPct: completed ? 100 : Math.min(99, Math.round((state.elapsedMs / total) * 100)),
      summary,
    });
  };

  useEffect(() => {
    if (state.status === 'finished') record(true);
    // record closes over the render that flipped status to finished
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const leave = () => {
    engine.stop();
    router.replace('/home');
  };

  const finishStop = () => {
    record(false);
    leave();
  };

  const onPausePress = useCallback(() => {
    setEndArmed(false);
    engine.pause();
  }, [engine]);
  const onResumePress = useCallback(() => {
    setEndArmed(false);
    engine.resume();
  }, [engine]);

  if (state.status === 'idle') {
    return <View style={styles.idle} />;
  }

  if (state.status === 'finished') {
    const summary = summaryRef.current ?? buildSummary(true, state.workout.totalMs);
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#241433', '#6A3E68', '#D4899A']} style={StyleSheet.absoluteFill} />
        <ScrollView
          contentContainerStyle={[styles.done, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]}
          showsVerticalScrollIndicator={false}
        >
          <FinishTitle title={FINISH_TITLE} reduceMotion={reduceMotion} />
          <Text style={styles.doneSub}>{FINISH_SUBTITLE}</Text>
          <DoneSummary summary={summary} onDone={leave} />
        </ScrollView>
      </View>
    );
  }

  const segmentProgress = duration > 0 ? 1 - remaining / duration : 0;
  const [top, bottom] = fieldColors(kind);
  const clockSize = clock.length > 3 ? 68 : 92;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[top, bottom]} style={StyleSheet.absoluteFill} />
      <View style={[styles.ride, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.hero}>
          <View style={styles.wattsRow}>
            <Text style={styles.watts} testID="live-watts" accessibilityLabel={watts == null ? 'No watts' : `${watts} watts`}>
              {watts == null ? '—' : String(watts)}
            </Text>
            <Text style={styles.wattsUnit}>w</Text>
          </View>
          {bpm == null ? null : (
            <Text style={styles.bpm} testID="live-bpm" accessibilityLabel={`${bpm} beats per minute`}>
              {bpm} bpm
            </Text>
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeText} testID="phase">
              {badge(kind, seg, settings.sets)}
            </Text>
          </View>
        </View>

        <View style={styles.clockBlock}>
          <View style={styles.clockRow}>
            <Text style={styles.timeLabel}>TIME</Text>
            <Text style={[styles.clock, { fontSize: clockSize }]} testID="countdown">
              {clock}
            </Text>
          </View>
          <Text style={styles.countLabel}>{short ? 'COUNTDOWN' : 'REMAINING'}</Text>
        </View>

        <View style={styles.footer}>
          <PauseResume running={state.status === 'running'} onPause={onPausePress} onResume={onResumePress} />
          {paused ? (
            endArmed ? (
              <View style={styles.endRow}>
                <Pressable onPress={() => setEndArmed(false)} testID="end-cancel" hitSlop={8}>
                  <Text style={styles.endCancel}>Cancel</Text>
                </Pressable>
                <Pressable onPress={finishStop} testID="end-confirm" hitSlop={8}>
                  <Text style={styles.endConfirm}>End session</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEndArmed(true)} testID="end" hitSlop={8} style={styles.endHit}>
                <Text style={styles.end}>End</Text>
              </Pressable>
            )
          ) : null}
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, Math.round(segmentProgress * 100)))}%` }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

function PauseResume({
  running,
  onPause,
  onResume,
}: {
  running: boolean;
  onPause: () => void;
  onResume: () => void;
}) {
  const fill = useRef(new Animated.Value(running ? 0 : 1)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const [word, setWord] = useState(running ? 'Pause' : 'Resume');
  const seen = useRef(false);

  useEffect(() => {
    if (!seen.current) {
      seen.current = true;
      return;
    }
    let fadeIn: Animated.CompositeAnimation | null = null;
    const fillAnim = Animated.timing(fill, {
      toValue: running ? 0 : 1,
      duration: 240,
      useNativeDriver: pauseDrivers.fill,
    });
    const fadeOut = Animated.timing(textOpacity, {
      toValue: 0,
      duration: 90,
      useNativeDriver: pauseDrivers.textOpacity,
    });
    fillAnim.start();
    fadeOut.start(({ finished }) => {
      if (!finished) return;
      setWord(running ? 'Pause' : 'Resume');
      fadeIn = Animated.timing(textOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: pauseDrivers.textOpacity,
      });
      fadeIn.start();
    });
    return () => {
      fillAnim.stop();
      fadeOut.stop();
      fadeIn?.stop();
    };
  }, [fill, running, textOpacity]);

  const backgroundColor = useMemo(
    () =>
      fill.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.28)'],
      }),
    [fill],
  );
  const borderColor = useMemo(
    () =>
      fill.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.45)'],
      }),
    [fill],
  );
  const textColor = useMemo(
    () =>
      fill.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.white, colors.white],
      }),
    [fill],
  );
  const motion = pauseResumeSlots({ backgroundColor, borderColor, textColor, textOpacity });

  return (
    <Animated.View style={[styles.pauseShell, motion.shell]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={running ? 'Pause' : 'Resume'}
        testID={running ? 'pause' : 'resume'}
        onPress={running ? onPause : onResume}
        style={styles.pauseHit}
      >
        <Animated.View pointerEvents="none" style={motion.fade}>
          <Animated.Text style={[styles.pauseLabel, motion.label]}>{word === 'Pause' ? '❚❚  Pause' : word}</Animated.Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function FinishTitle({ title, reduceMotion }: { title: string; reduceMotion: boolean }) {
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 0.94)).current;
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0.35)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 460, useNativeDriver: nativeMotion }),
      Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: nativeMotion }),
    ]).start();
  }, [opacity, reduceMotion, scale]);

  return (
    <Animated.Text style={[styles.doneTitle, { opacity, transform: [{ scale }] }]}>{title}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  idle: { flex: 1, backgroundColor: colors.bg },
  ride: { flex: 1, paddingHorizontal: 22 },
  hero: { alignItems: 'center', marginTop: 18 },
  wattsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  watts: {
    color: colors.white,
    fontSize: 96,
    lineHeight: 100,
    fontWeight: '700',
    letterSpacing: -3,
    fontVariant: ['tabular-nums'],
  },
  wattsUnit: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '600',
    marginTop: 18,
    marginLeft: 2,
  },
  bpm: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  badgeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  clockBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  clockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  timeLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  clock: {
    color: colors.white,
    fontWeight: '700',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  countLabel: {
    marginTop: 6,
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },
  footer: { gap: 12, paddingBottom: 6 },
  pauseShell: {
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pauseHit: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  endHit: { alignItems: 'center', paddingVertical: 4 },
  end: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '600' },
  endRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 },
  endCancel: { color: 'rgba(255,255,255,0.75)', fontSize: 16 },
  endConfirm: { color: colors.white, fontSize: 16, fontWeight: '700' },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  fill: { height: 3, backgroundColor: colors.white },
  done: { flex: 1, paddingHorizontal: 20, gap: 8 },
  doneTitle: {
    color: colors.white,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  doneSub: { color: 'rgba(255,255,255,0.82)', fontSize: 17, fontWeight: '500', marginBottom: 8 },
});
