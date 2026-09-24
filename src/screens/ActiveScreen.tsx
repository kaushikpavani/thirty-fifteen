import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressRing } from '../components/ProgressRing';
import { PrimaryButton } from '../components/PrimaryButton';
import type { EngineState } from '../hooks/useWorkoutEngine';
import {
  colors,
  phaseColor,
  phaseGlow,
  phaseLabel,
} from '../theme/colors';
import type { WorkoutSettings } from '../types';
import { formatClock, formatDuration } from '../workout/builder';

type Props = {
  settings: WorkoutSettings;
  state: EngineState;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDoneHome: () => void;
};

export function ActiveScreen({
  settings,
  state,
  onPause,
  onResume,
  onStop,
  onDoneHome,
}: Props) {
  const [stopArmed, setStopArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seg = state.segment;
  const kind = seg?.kind ?? 'warmup';
  const accent = phaseColor(kind);
  const glow = phaseGlow(kind);
  const duration = seg?.durationMs ?? 1;
  const remaining = state.remainingInSegmentMs;
  const ringProgress = duration > 0 ? remaining / duration : 0;
  const secondsHuge = Math.max(0, Math.ceil(remaining / 1000));

  const setLabel = useMemo(() => {
    if (!seg?.setNumber) return null;
    return `Set ${seg.setNumber}/${settings.sets}`;
  }, [seg, settings.sets]);

  const repLabel = useMemo(() => {
    if (!seg?.repNumber) return null;
    return `Rep ${seg.repNumber}/${settings.reps}`;
  }, [seg, settings.reps]);

  const nextPreview = state.nextSegment
    ? `${phaseLabel(state.nextSegment.kind)}${
        state.nextSegment.targetWatts != null
          ? ` · ${state.nextSegment.targetWatts} W`
          : ''
      }`
    : state.status === 'finished'
      ? 'Session complete'
      : '—';

  const confirmStop = () => {
    Alert.alert('Stop workout?', 'Timer will reset. Progress will be lost.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: onStop },
    ]);
  };

  const onStopPress = () => {
    if (stopArmed) {
      onStop();
      setStopArmed(false);
      return;
    }
    setStopArmed(true);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setStopArmed(false), 2500);
  };

  if (state.status === 'finished') {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#0B1F1A', colors.bg]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.doneWrap}>
            <Text style={styles.doneKicker}>SESSION COMPLETE</Text>
            <Text style={styles.doneTitle}>Nice work</Text>
            <Text style={styles.doneSub}>
              {formatDuration(state.workout.totalMs)} of focused 30/15 work.
            </Text>
            <PrimaryButton label="Back to Home" onPress={onDoneHome} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.bgElevated, colors.bg, '#070A0E']}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: glow, opacity: 0.55 }]}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topBar}>
          <View style={[styles.phasePill, { backgroundColor: glow, borderColor: accent }]}>
            <Text style={[styles.phaseText, { color: accent }]}>
              {phaseLabel(kind)}
            </Text>
          </View>
          <Text style={styles.overall}>
            {Math.round(state.progress01 * 100)}% · {formatClock(state.elapsedMs)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          {setLabel ? <Text style={styles.meta}>{setLabel}</Text> : <Text style={styles.meta}>—</Text>}
          {repLabel ? <Text style={styles.meta}>{repLabel}</Text> : null}
        </View>

        <View style={styles.ringWrap}>
          <ProgressRing
            size={300}
            stroke={14}
            progress={ringProgress}
            color={accent}
            trackColor={colors.border}
          >
            <Text style={[styles.seconds, { color: accent }]}>{secondsHuge}</Text>
            <Text style={styles.secondsUnit}>sec</Text>
            <Text style={styles.segLabel}>{seg?.label ?? ''}</Text>
          </ProgressRing>
        </View>

        <View style={styles.targetCard}>
          <Text style={styles.targetLabel}>TARGET</Text>
          <Text style={styles.targetWatts}>
            {seg?.targetWatts != null ? `${seg.targetWatts} W` : '—'}
          </Text>
          <Text style={styles.targetHint}>{seg?.targetHint ?? ''}</Text>
        </View>

        <View style={styles.nextCard}>
          <Text style={styles.nextLabel}>NEXT UP</Text>
          <Text style={styles.nextValue}>{nextPreview}</Text>
        </View>

        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.round(state.progress01 * 100)}%`, backgroundColor: accent },
            ]}
          />
        </View>

        <View style={styles.controls}>
          {state.status === 'running' ? (
            <PrimaryButton label="Pause" onPress={onPause} variant="secondary" style={{ flex: 1 }} />
          ) : (
            <PrimaryButton label="Resume" onPress={onResume} variant="primary" style={{ flex: 1 }} />
          )}
          <PrimaryButton
            label={stopArmed ? 'Tap again' : 'Stop'}
            onPress={onStopPress}
            onLongPress={confirmStop}
            variant="danger"
            style={{ flex: 1 }}
          />
        </View>
        <Text style={styles.stopHint}>Long-press Stop to confirm · or double-tap</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingHorizontal: 20, paddingBottom: 12 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  phasePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  phaseText: { fontWeight: '900', letterSpacing: 1.5, fontSize: 14 },
  overall: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 14,
  },
  meta: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  ringWrap: { alignItems: 'center', marginTop: 10, marginBottom: 8 },
  seconds: {
    fontSize: 96,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 100,
  },
  secondsUnit: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
    marginTop: -4,
  },
  segLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  targetCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetLabel: {
    color: colors.textDim,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontSize: 11,
  },
  targetWatts: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
  },
  targetHint: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  nextCard: {
    marginTop: 10,
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  nextLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  nextValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 99,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 99 },
  controls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  stopHint: {
    textAlign: 'center',
    color: colors.textDim,
    fontSize: 12,
    marginTop: 10,
  },
  doneWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  doneKicker: {
    color: colors.done,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  doneTitle: { color: colors.text, fontSize: 40, fontWeight: '900' },
  doneSub: { color: colors.textMuted, fontSize: 16, marginBottom: 12 },
});
