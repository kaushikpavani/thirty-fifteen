import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { bleGate } from '../ble/availability';
import { Atmosphere } from '../components/Atmosphere';
import { DigitClock, FadeLabel } from '../components/MotionText';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SegmentRail } from '../components/SegmentRail';
import { useHistory } from '../state/HistoryContext';
import { usePowerMeter } from '../state/PowerMeterContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkout } from '../state/WorkoutContext';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, phaseColor, phaseLabel } from '../theme/colors';
import { formatClock } from '../workout/builder';

const nativeMotion = Platform.OS !== 'web';

export function ActiveScreen() {
  const engine = useWorkout();
  const history = useHistory();
  const { settings } = useSettings();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const savedRef = useRef<number | null>(null);
  const [armed, setArmed] = useState<'end' | 'restart' | null>(null);

  const { state } = engine;
  const seg = state.segment;
  const kind = seg?.kind ?? 'warmup';
  const accent = phaseColor(kind);
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
    restart: engine.restartSegment,
    shorten: engine.shortenSegment,
    skip: engine.skipSegment,
  });
  actions.current.pause = engine.pause;
  actions.current.resume = engine.resume;
  actions.current.finish = finishStop;
  actions.current.restart = engine.restartSegment;
  actions.current.shorten = engine.shortenSegment;
  actions.current.skip = engine.skipSegment;
  const onPausePress = useCallback(() => {
    setArmed(null);
    actions.current.pause();
  }, []);
  const onResumePress = useCallback(() => {
    setArmed(null);
    actions.current.resume();
  }, []);
  const onStopPress = useCallback(() => actions.current.finish(), []);
  const onConfirmRestart = useCallback(() => {
    setArmed(null);
    actions.current.restart();
  }, []);
  const onShortenPress = useCallback(() => {
    setArmed(null);
    actions.current.shorten();
  }, []);
  const onSkipPress = useCallback(() => {
    setArmed(null);
    actions.current.skip();
  }, []);

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

  const paused = state.status === 'paused';
  const segmentProgress = duration > 0 ? 1 - remaining / duration : 0;

  return (
    <Screen bottom>
      <Atmosphere color={accent} paused={paused} reduceMotion={reduceMotion} />
      <SegmentRail progress={segmentProgress} color={accent} paused={paused} reduceMotion={reduceMotion} />
      <View style={styles.body}>
        <FadeLabel value={phaseLabel(kind)} style={styles.phase} testID="phase" />
        <DigitClock
          value={clock}
          color={colors.text}
          fontSize={fontSize}
          dim={paused}
          reduceMotion={reduceMotion}
          testID="countdown"
        />
        <FadeLabel value={caption} style={styles.caption} />
      </View>
      <WorkoutControls
        running={state.status === 'running'}
        armed={armed}
        onPause={onPausePress}
        onResume={onResumePress}
        onArm={(which) => setArmed(which)}
        onCancel={() => setArmed(null)}
        onConfirmEnd={onStopPress}
        onConfirmRestart={onConfirmRestart}
        onShorten={onShortenPress}
        onSkip={onSkipPress}
      />
    </Screen>
  );
}

const WorkoutControls = React.memo(function WorkoutControls({
  running,
  armed,
  onPause,
  onResume,
  onArm,
  onCancel,
  onConfirmEnd,
  onConfirmRestart,
  onShorten,
  onSkip,
}: {
  running: boolean;
  armed: 'end' | 'restart' | null;
  onPause: () => void;
  onResume: () => void;
  onArm: (which: 'end' | 'restart') => void;
  onCancel: () => void;
  onConfirmEnd: () => void;
  onConfirmRestart: () => void;
  onShorten: () => void;
  onSkip: () => void;
}) {
  const open = useRef(new Animated.Value(running ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(open, {
      toValue: running ? 0 : 1,
      duration: running ? 160 : 240,
      useNativeDriver: nativeMotion,
    }).start();
  }, [open, running]);

  return (
    <View style={styles.footer}>
      <PauseResume running={running} onPause={onPause} onResume={onResume} />
      {running ? null : (
        <Animated.View
          style={[
            styles.stack,
            {
              opacity: open,
              transform: [
                {
                  translateY: open.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }),
                },
              ],
            },
          ]}
        >
          <TransportChip label="Shorten" hint="End this segment and continue" onPress={onShorten} testID="shorten" />
          <TransportChip label="Skip" hint="Skip ahead to the next interval" onPress={onSkip} testID="skip" />
          {armed === 'restart' ? (
            <ConfirmRow
              cancelID="restart-cancel"
              confirmID="restart-confirm"
              confirm="Restart segment"
              onCancel={onCancel}
              onConfirm={onConfirmRestart}
            />
          ) : (
            <TransportChip
              label="Restart"
              hint="Restart this segment"
              onPress={() => onArm('restart')}
              testID="restart"
            />
          )}
          {armed === 'end' ? (
            <ConfirmRow
              cancelID="end-cancel"
              confirmID="end-confirm"
              confirm="End session"
              onCancel={onCancel}
              onConfirm={onConfirmEnd}
            />
          ) : (
            <TransportChip label="End" hint="End the session" onPress={() => onArm('end')} testID="end" />
          )}
        </Animated.View>
      )}
    </View>
  );
});

function ConfirmRow({
  cancelID,
  confirmID,
  confirm,
  onCancel,
  onConfirm,
}: {
  cancelID: string;
  confirmID: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.confirmRow}>
      <Pressable onPress={onCancel} testID={cancelID} hitSlop={8}>
        <Text style={styles.endCancel}>Cancel</Text>
      </Pressable>
      <Pressable style={styles.chip} onPress={onConfirm} testID={confirmID} hitSlop={8}>
        <Text style={styles.chipText}>{confirm}</Text>
      </Pressable>
    </View>
  );
}

function TransportChip({
  label,
  hint,
  onPress,
  testID,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={onPress}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => [styles.transportChip, pressed && styles.transportChipPressed]}
    >
      <Text style={styles.transportText}>{label}</Text>
    </Pressable>
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
    Animated.timing(fill, {
      toValue: running ? 0 : 1,
      duration: 240,
      useNativeDriver: false,
    }).start();
    const fade = Animated.timing(textOpacity, { toValue: 0, duration: 90, useNativeDriver: nativeMotion });
    fade.start(({ finished }) => {
      if (!finished) return;
      setWord(running ? 'Pause' : 'Resume');
      Animated.timing(textOpacity, { toValue: 1, duration: 160, useNativeDriver: nativeMotion }).start();
    });
    return () => fade.stop();
  }, [fill, running, textOpacity]);

  const backgroundColor = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0)', colors.white],
  });
  const borderColor = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, 'rgba(255,255,255,0)'],
  });
  const textColor = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.text, colors.black],
  });

  return (
    <Animated.View style={[styles.pauseShell, { backgroundColor, borderColor }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={running ? 'Pause' : 'Resume'}
        testID={running ? 'pause' : 'resume'}
        onPress={running ? onPause : onResume}
        style={styles.pauseHit}
      >
        <Animated.Text style={[styles.pauseLabel, { color: textColor, opacity: textOpacity }]}>{word}</Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

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

const styles = StyleSheet.create({
  pauseShell: {
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: 16,
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
    fontSize: 17,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  phase: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 12,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 10,
  },
  stack: {
    gap: 8,
  },
  confirmRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  transportChip: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportChipPressed: { opacity: 0.55 },
  transportText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  endCancel: { color: colors.textMuted, fontSize: 14, paddingVertical: 6 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: colors.hard,
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
