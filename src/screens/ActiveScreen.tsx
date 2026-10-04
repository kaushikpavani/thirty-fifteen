import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoneSummary } from '../components/DoneSummary';
import { Icon } from '../components/kit/Icon';
import { Pill } from '../components/kit/Pill';
import { RepRail } from '../components/kit/ProfileChart';
import { HoldToEnd, PauseGlass, StatTriplet, WarmupJump } from '../components/ride/Controls';
import { PhaseField } from '../components/ride/PhaseField';
import { PowerGauge } from '../components/ride/PowerGauge';
import { RideVideo } from '../components/ride/RideVideo';
import { RIDE_VIDEO } from '../content/videos';
import { BIKE_TONES, RoadBike, RoadStream } from '../components/bike/RoadBike';
import { useHistory } from '../state/HistoryContext';
import { useHeartRate } from '../state/HeartRateContext';
import { usePowerMeter } from '../state/PowerMeterContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkout } from '../state/WorkoutContext';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { usePowerCoach } from '../hooks/usePowerCoach';
import { useRideRecorder } from '../hooks/useRideRecorder';
import { fieldFor, fields, ink, type as t } from '../theme/tokens';
import type { PhaseKind } from '../types';
import { endChoice } from '../logic/endRide';
import { clockText, nextHardRep, rideView } from '../logic/rideView';
import { warmupJumpMs } from '../workout/transport';

const native = Platform.OS !== 'web';

/** Wheels turn with the effort: quick in HARD, loose in EASY, lazy in rest. */
function wheelPeriod(kind: PhaseKind): number {
  if (kind === 'hard' || kind === 'accel') return 380;
  if (kind === 'easy') return 900;
  if (kind === 'warmup') return 700;
  return 1200;
}

export function ActiveScreen() {
  const engine = useWorkout();
  const history = useHistory();
  const { settings } = useSettings();
  const meter = usePowerMeter();
  const heart = useHeartRate();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state } = engine;
  const seg = state.segment;
  const kind = seg?.kind ?? 'warmup';
  const paused = state.status === 'paused';
  const watts = meter.live?.watts ?? null;
  const bpm = heart.live?.bpm ?? null;
  const { record, discard, summary, hardAvg } = useRideRecorder({
    state,
    settings,
    watts,
    bpm,
    addSession: history.addSession,
    discardRide: history.discardRide,
  });
  // Only with a power meter sending fresh readings; without one the ride keeps its normal cues and music.
  usePowerCoach({ state, settings, watts: meter.connectionState === 'connected' ? watts : null });
  /** Ended before the sets were done: the rider is being asked whether to keep the ride. */
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!engine.armedRef.current) router.replace('/home');
  }, [engine.armedRef]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (state.status === 'finished') record(true);
  }, [state.status, record]);

  const leave = () => {
    engine.stop();
    router.replace('/home');
  };

  const saveAndLeave = () => {
    record(false);
    leave();
  };

  const deleteAndLeave = () => {
    discard();
    leave();
  };

  // Sets done (cool-down): just save. Part-way: ask. A few seconds in: nothing to keep.
  const finishStop = () => {
    if (endChoice(state.workout.segments, state.elapsedMs) === 'ask') setAsking(true);
    else saveAndLeave();
  };

  const onPause = useCallback(() => engine.pause(), [engine]);
  const onResume = useCallback(() => {
    setAsking(false);
    engine.resume();
  }, [engine]);

  const view = useMemo(
    () =>
      rideView({
        segments: state.workout.segments,
        index: state.segmentIndex,
        remainingMs: state.remainingInSegmentMs,
        elapsedMs: state.elapsedMs,
        totalMs: state.workout.totalMs,
        sets: settings.sets,
        reps: settings.reps,
        workMs: settings.workSec * 1000,
        recoverMs: settings.recoverSec * 1000,
        hardWatts: state.workout.hardWatts,
        easyWatts: state.workout.easyWatts,
      }),
    [
      state.workout,
      state.segmentIndex,
      state.remainingInSegmentMs,
      state.elapsedMs,
      settings.sets,
      settings.reps,
      settings.workSec,
      settings.recoverSec,
    ],
  );

  if (state.status === 'idle') {
    return <View style={styles.idle} />;
  }

  if (state.status === 'finished') {
    if (!summary) return <View style={styles.idle} />;
    return (
      <DoneSummary
        summary={summary}
        reps={settings.reps}
        hardTarget={state.workout.hardWatts}
        ftpWatts={settings.ftpWatts}
        onDone={leave}
      />
    );
  }

  const top = insets.top + 14;
  const bottom = Math.max(insets.bottom, 16) + 20;

  if (paused) {
    return (
      <View style={styles.root}>
        <PhaseField field={fields.paused} progress={0} rise={null} reduceMotion={reduceMotion} />
        <View style={[styles.stack, { paddingTop: top, paddingBottom: bottom }]}>
          <View style={styles.header}>
            <Text style={styles.phase} accessibilityRole="header">
              PAUSED
            </Text>
            <Text style={styles.contextDim}>
              {view.phase}
              {view.context ? ` · ${view.context}` : ''}
            </Text>
          </View>
          <View style={styles.railWrap}>
            <Rail view={view} dim />
          </View>
          <Text style={[styles.frozen]} testID="countdown" accessibilityLabel={`${view.clock} left`}>
            {view.clock}
          </Text>
          <Text style={styles.frozenLabel}>{kind === 'hard' || kind === 'easy' ? 'left in this rep' : 'left in this part'}</Text>
          <View style={{ marginTop: 40, alignSelf: 'stretch' }}>
            <StatTriplet
              items={[
                { value: hardAvg == null ? '—' : String(hardAvg), label: 'W hard avg' },
                { value: bpm == null ? '—' : String(bpm), label: 'bpm' },
                { value: clockText(state.activeMs), label: 'elapsed' },
              ]}
            />
          </View>
          <View style={styles.flex} />
          {asking ? (
            <View style={styles.ask} accessibilityViewIsModal testID="end-choice">
              <Text style={styles.askTitle} accessibilityRole="header">
                Save this ride?
              </Text>
              <Text style={styles.askBody}>You stopped before the sets were finished. Keep what you rode, or delete it for good.</Text>
              <Pill label="Save ride" onPress={saveAndLeave} testID="end-save" style={styles.stretch} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete ride"
                accessibilityHint="Deletes this ride from this iPhone and from your account. This can't be undone."
                testID="end-delete"
                onPress={deleteAndLeave}
                style={styles.askRow}
              >
                <Text style={styles.askDelete}>Delete ride</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Keep riding" testID="end-back" onPress={onResume} style={styles.askRow}>
                <Text style={styles.askBack}>Keep riding</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Pill label="Resume" icon="play" onPress={onResume} testID="resume" style={styles.stretch} />
              <View style={{ height: 12 }} />
              <HoldToEnd onEnd={finishStop} />
              <Text style={styles.savedNote}>
                {endChoice(state.workout.segments, state.elapsedMs) === 'ask' ? 'You can save or delete the ride after ending.' : 'Ending saves the ride.'}
              </Text>
            </>
          )}
        </View>
      </View>
    );
  }

  const field = fieldFor(kind);
  // Halve / Skip only while there is warm-up left to cut; the main set is never skippable.
  const canJump = warmupJumpMs(state.workout.segments, state.elapsedMs, 'skip') != null;
  const nextRep = view.countIn != null ? nextHardRep(state.workout.segments, state.segmentIndex) : null;

  return (
    <View style={styles.root}>
      <PhaseField field={field} progress={view.progress} rise={view.rise} reduceMotion={reduceMotion} />
      <View style={[styles.stack, { paddingTop: top, paddingBottom: bottom }]}>
        <View style={styles.header}>
          <PhaseWord word={view.phase} reduceMotion={reduceMotion} />
          <Text style={styles.context} numberOfLines={1}>
            {view.context}
          </Text>
        </View>
        <View style={styles.railWrap}>
          <Rail view={view} />
        </View>
        <View style={styles.captions}>
          <Text style={styles.caption}>{view.caption}</Text>
          <Text style={styles.caption}>{view.toGo}</Text>
        </View>

        <View style={styles.gauge}>
          <PowerGauge watts={watts} target={view.target} width={Math.min(width - 32, 360)} reduceMotion={reduceMotion} />
        </View>
        {!view.cue.target ? (
          <View style={styles.cue}>
            <Text style={styles.cueText}>{view.cue.text}</Text>
          </View>
        ) : null}

        <View style={styles.bpmRow} testID="live-bpm" accessibilityLabel={bpm == null ? 'No heart rate' : `${bpm} beats per minute`}>
          <Icon name="heart" size={24} color={bpm == null ? 'rgba(255,255,255,0.5)' : '#FFFFFF'} />
          {bpm == null ? <View style={styles.emptyBpm} /> : <Text style={[t.bpm, styles.white]}>{bpm}</Text>}
          <Text style={styles.bpmUnit}>bpm</Text>
        </View>

        {RIDE_VIDEO != null ? (
          <View style={styles.videoSlot} pointerEvents="none">
            <RideVideo source={RIDE_VIDEO} still={reduceMotion} style={styles.video} />
          </View>
        ) : (
          <View style={styles.bikeWash} pointerEvents="none">
            <RoadBike width={210} tone={BIKE_TONES.line} line wheelPeriodMs={reduceMotion ? null : wheelPeriod(kind)} />
            <RoadStream width={260} periodMs={reduceMotion ? null : wheelPeriod(kind) * 0.6} color="rgba(255,255,255,0.8)" />
          </View>
        )}
        {view.countIn != null ? (
          <CountIn seconds={view.countIn} rep={nextRep} reduceMotion={reduceMotion} />
        ) : (
          <Text style={[t.countdown, styles.white]} testID="countdown" accessibilityLabel={`${view.clock} left`}>
            {view.clock}
          </Text>
        )}
        <View style={{ height: 24 }} />
        {canJump ? (
          <View style={styles.controlRow}>
            <WarmupJump icon="forward" label="Halve" hint="Cuts what is left of the warm-up in half" onPress={() => engine.jumpWarmup('halve')} testID="warmup-halve" />
            <PauseGlass onPress={onPause} />
            <WarmupJump icon="skip" label="Skip" hint="Skips to just before the first hard rep" onPress={() => engine.jumpWarmup('skip')} testID="warmup-skip" />
          </View>
        ) : (
          <PauseGlass onPress={onPause} />
        )}
      </View>
    </View>
  );
}

function Rail({ view, dim = false }: { view: ReturnType<typeof rideView>; dim?: boolean }) {
  const solid = dim ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.95)';
  const faint = dim ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)';
  if (view.rail.kind === 'reps') {
    const full = view.phase === 'SET REST';
    return (
      <RepRail
        count={view.rail.count}
        done={view.rail.done}
        progress={view.rail.progress}
        solid={full && !dim ? '#5CC8E6' : solid}
        faint={faint}
      />
    );
  }
  return <RepRail count={1} done={0} progress={view.rail.progress} solid={solid} faint={faint} />;
}

/** The phase word slides up 8 pt when it changes. */
function PhaseWord({ word, reduceMotion }: { word: string; reduceMotion: boolean }) {
  const y = useAnimatedValue(0);
  const o = useAnimatedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current || reduceMotion) {
      first.current = false;
      return;
    }
    y.setValue(8);
    o.setValue(0);
    Animated.parallel([
      Animated.spring(y, { toValue: 0, useNativeDriver: native, speed: 18, bounciness: 4 }),
      Animated.timing(o, { toValue: 1, duration: 260, useNativeDriver: native }),
    ]).start();
  }, [word, reduceMotion, o, y]);
  return (
    <Animated.Text
      style={[styles.phase, { opacity: o, transform: [{ translateY: y }] }]}
      testID="phase"
      accessibilityRole="header"
      accessibilityLiveRegion="polite"
    >
      {word}
    </Animated.Text>
  );
}

/** 3 · 2 · 1 in the incoming color's space. Each digit lands with a small settle. */
function CountIn({ seconds, rep, reduceMotion }: { seconds: number; rep: number | null; reduceMotion: boolean }) {
  const scale = useAnimatedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    scale.setValue(1.14);
    Animated.timing(scale, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [seconds, reduceMotion, scale]);
  return (
    <View style={styles.countIn} accessibilityLiveRegion="assertive" accessibilityLabel={`Hard in ${seconds}`}>
      <Text style={styles.countInLabel}>{rep != null ? `HARD ${rep} IN` : 'HARD IN'}</Text>
      <Animated.Text style={[t.countIn, styles.white, { transform: [{ scale }] }]} testID="countdown">
        {seconds}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  idle: { flex: 1, backgroundColor: '#000' },
  stack: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  header: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  phase: { ...t.phase, color: '#FFFFFF' },
  context: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1, marginLeft: 12 },
  contextDim: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  railWrap: { alignSelf: 'stretch', marginTop: 12 },
  captions: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  caption: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
  wattsRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 52, maxWidth: '100%' },
  white: { color: '#FFFFFF' },
  emptyWatts: { width: 72, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.45)', marginVertical: 69, marginRight: 8 },
  emptyBpm: { width: 34, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)', marginVertical: 23 },
  unit: { color: 'rgba(255,255,255,0.9)', marginLeft: 4 },
  cue: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  cueText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  bpmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  gauge: { marginTop: 18 },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36 },
  bpmUnit: { color: 'rgba(255,255,255,0.9)', fontSize: 19, fontWeight: '600', alignSelf: 'flex-end', paddingBottom: 6 },
  flex: { flex: 1 },
  videoSlot: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', paddingVertical: 10, minHeight: 90 },
  video: { flex: 1, minHeight: 90 },
  bikeWash: { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.16, gap: 2 },
  countIn: { alignItems: 'center' },
  countInLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 3 },
  frozen: { ...t.countdown, fontSize: 112, lineHeight: 118, color: 'rgba(255,255,255,0.55)', marginTop: 84 },
  frozenLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 15, marginTop: 8 },
  stretch: { alignSelf: 'stretch' },
  ask: { alignSelf: 'stretch', alignItems: 'center', gap: 6 },
  askTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  askBody: { color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: 12 },
  askRow: { alignSelf: 'stretch', minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  askDelete: { color: ink.danger, fontSize: 17, fontWeight: '600' },
  askBack: { color: 'rgba(255,255,255,0.85)', fontSize: 17, fontWeight: '500' },
  savedNote: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 14 },
});
