import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { bleGate } from '../ble/availability';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useHistory } from '../state/HistoryContext';
import { usePowerMeter } from '../state/PowerMeterContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkout } from '../state/WorkoutContext';
import { colors, phaseColor, phaseGlow, phaseLabel } from '../theme/colors';
import { formatClock } from '../workout/builder';

export function ActiveScreen() {
  const engine = useWorkout();
  const history = useHistory();
  const { settings } = useSettings();
  const { width } = useWindowDimensions();
  const savedRef = useRef<number | null>(null);
  const [endArmed, setEndArmed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const nativeDriver = Platform.OS !== 'web';

  const { state } = engine;
  const seg = state.segment;
  const kind = seg?.kind ?? 'warmup';
  const accent = phaseColor(kind);
  const glow = phaseGlow(kind);
  const duration = seg?.durationMs ?? 1;
  const remaining = state.remainingInSegmentMs;
  const short = duration <= 90_000;
  const clock = short ? String(Math.max(0, Math.ceil(remaining / 1000))) : formatClock(remaining);
  const heroSize = Math.min(160, Math.round(width * 0.4));
  const fontSize = clock.length > 3 ? Math.round(heroSize * 0.62) : heroSize;

  useEffect(() => {
    if (!engine.armedRef.current) router.replace('/home');
  }, [engine.armedRef]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    scale.setValue(0.94);
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 90,
      useNativeDriver: nativeDriver,
    }).start();
  }, [kind, nativeDriver, scale]);

  const record = (completed: boolean) => {
    const startedAt = state.startedAt;
    if (!startedAt || savedRef.current === startedAt) return;
    if (!completed && state.elapsedMs < 5000) return;
    savedRef.current = startedAt;
    const total = state.workout.totalMs || 1;
    void history.addSession({
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      durationMs: completed ? total : state.elapsedMs,
      plannedDurationMs: total,
      ftpWatts: settings.ftpWatts,
      hardWatts: state.workout.hardWatts,
      easyWatts: state.workout.easyWatts,
      completed,
      completionPct: completed ? 100 : Math.min(99, Math.round((state.elapsedMs / total) * 100)),
    });
  };

  useEffect(() => {
    if (state.status === 'finished') record(true);
    // record closes over the render that flipped status to finished
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const caption = useMemo(() => {
    if (state.status === 'paused') return 'Paused';
    if (seg?.setNumber && seg.repNumber) {
      return `Set ${seg.setNumber} of ${settings.sets}  ·  Rep ${seg.repNumber}`;
    }
    return seg?.label ?? '';
  }, [seg, settings.sets, state.status]);

  const leave = () => {
    engine.stop();
    router.replace('/home');
  };

  const finishStop = () => {
    record(false);
    leave();
  };

  const actions = useRef({
    pause: engine.pause,
    resume: engine.resume,
    finish: finishStop,
  });
  actions.current.pause = engine.pause;
  actions.current.resume = engine.resume;
  actions.current.finish = finishStop;
  const onPausePress = useCallback(() => actions.current.pause(), []);
  const onResumePress = useCallback(() => actions.current.resume(), []);
  const onStopPress = useCallback(() => actions.current.finish(), []);

  if (state.status === 'idle') {
    return <View style={styles.idle} />;
  }

  if (state.status === 'finished') {
    return (
      <Screen bottom>
        <View style={styles.done}>
          <Text style={styles.doneTitle}>Done.</Text>
          <Text style={styles.doneMeta}>{formatClock(state.workout.totalMs)}</Text>
          <PrimaryButton label="Home" onPress={leave} testID="done-home" />
          <FinishMeter />
        </View>
      </Screen>
    );
  }

  const target = seg?.targetWatts;

  return (
    <Screen bottom>
      <PhaseWash color={glow} />
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(state.progress01 * 100)}%`, backgroundColor: accent }]} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.phase, { color: accent }]}>{phaseLabel(kind)}</Text>
        <Animated.Text
          style={[
            styles.clock,
            {
              color: accent,
              fontSize,
              lineHeight: fontSize + 4,
              opacity: state.status === 'paused' ? 0.55 : 1,
              transform: [{ scale }],
            },
          ]}
          testID="countdown"
        >
          {clock}
        </Animated.Text>
        {target != null ? (
          <View style={styles.wattsBlock}>
            <Text style={styles.wattsKicker}>TARGET</Text>
            <Text style={styles.watts} testID="target-watts">
              {target}
            </Text>
            <Text style={styles.caption}>{caption}</Text>
          </View>
        ) : (
          <Text style={styles.caption}>{caption}</Text>
        )}
      </View>
      <WorkoutControls
        running={state.status === 'running'}
        endArmed={endArmed}
        onPause={() => {
          setEndArmed(false);
          onPausePress();
        }}
        onResume={onResumePress}
        onArmEnd={() => setEndArmed(true)}
        onCancelEnd={() => setEndArmed(false)}
        onConfirmEnd={onStopPress}
      />
    </Screen>
  );
}

const WorkoutControls = React.memo(function WorkoutControls({
  running,
  endArmed,
  onPause,
  onResume,
  onArmEnd,
  onCancelEnd,
  onConfirmEnd,
}: {
  running: boolean;
  endArmed: boolean;
  onPause: () => void;
  onResume: () => void;
  onArmEnd: () => void;
  onCancelEnd: () => void;
  onConfirmEnd: () => void;
}) {
  return (
    <View style={styles.controls}>
      {running ? (
        <PrimaryButton variant="hairline" label="Pause" onPress={onPause} style={styles.control} testID="pause" />
      ) : (
        <PrimaryButton label="Resume" onPress={onResume} style={styles.control} testID="resume" />
      )}
      {endArmed ? (
        <View style={styles.endSlot}>
          <Pressable onPress={onCancelEnd} testID="end-cancel">
            <Text style={styles.endCancel}>Keep going</Text>
          </Pressable>
          <Pressable style={styles.chip} onPress={onConfirmEnd} testID="end-confirm">
            <Text style={styles.chipText}>End session</Text>
          </Pressable>
        </View>
      ) : (
        <PrimaryButton variant="quiet" label="End" onPress={onArmEnd} style={styles.control} testID="end" />
      )}
    </View>
  );
});

function FinishMeter() {
  const meter = usePowerMeter();
  const [open, setOpen] = useState(false);
  if (bleGate()) return null;

  return (
    <View style={styles.meter}>
      <Pressable onPress={() => setOpen((value) => !value)} testID="finish-power">
        <Text style={styles.meterLink}>{open ? 'Hide power meter' : 'Power meter'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.meterBody}>
          <Text style={styles.doneMeta}>
            {meter.phase.phase === 'connected'
              ? meter.phase.name
              : 'Optional. Watts show up only when a meter sends them.'}
          </Text>
          {meter.live ? (
            <Text style={styles.meterLive} testID="finish-live-watts">
              {meter.live.watts} W
              {meter.live.speedKph != null ? ` · ${meter.live.speedKph.toFixed(1)} km/h` : ''}
            </Text>
          ) : null}
          {meter.devices.map((device) => (
            <Pressable key={device.id} onPress={() => meter.pick(device)}>
              <Text style={styles.meterLink}>{device.name}</Text>
            </Pressable>
          ))}
          {meter.phase.phase === 'connected' ? (
            <PrimaryButton variant="quiet" label="Disconnect" onPress={() => void meter.disconnect()} />
          ) : (
            <PrimaryButton
              variant="hairline"
              label={meter.phase.phase === 'scanning' ? 'Scanning…' : 'Scan'}
              onPress={meter.connect}
              disabled={meter.phase.phase === 'scanning' || meter.phase.phase === 'connecting'}
              testID="finish-scan"
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

function PhaseWash({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState(color);
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (shown === color) return;
    Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: native }).start(({ finished }) => {
      if (!finished) return;
      setShown(color);
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: native }).start();
    });
  }, [color, native, opacity, shown]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: shown, opacity },
        Platform.OS === 'web' ? { pointerEvents: 'none' as const } : null,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 2,
    backgroundColor: colors.borderSoft,
    marginHorizontal: 28,
    marginTop: 8,
  },
  progressFill: { height: 2 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  phase: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 12,
  },
  clock: {
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
  },
  wattsBlock: { alignItems: 'center', marginTop: 18, gap: 2 },
  wattsKicker: {
    color: colors.textDim,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '600',
  },
  watts: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  caption: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  control: { flex: 1 },
  endSlot: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  endCancel: { color: colors.textDim, fontSize: 14, paddingVertical: 6 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.bgSoft,
  },
  chipText: { color: colors.hard, fontSize: 15, fontWeight: '600' },
  done: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  doneTitle: {
    color: colors.text,
    fontSize: 64,
    fontWeight: '200',
    letterSpacing: -1.5,
  },
  doneMeta: {
    color: colors.textMuted,
    fontSize: 16,
    marginBottom: 18,
  },
  meter: { marginTop: 28, gap: 8 },
  meterLink: { color: colors.textDim, fontSize: 15 },
  meterBody: { gap: 10, marginTop: 8 },
  meterLive: { color: colors.text, fontSize: 28, fontWeight: '300', fontVariant: ['tabular-nums'] },
  idle: { flex: 1, backgroundColor: colors.bg },
});
