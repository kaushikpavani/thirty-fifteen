import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { FtpChangeNotice } from '../components/FtpChangeNotice';
import { AccountBadge } from '../components/kit/AccountBadge';
import { GlassButton } from '../components/kit/Glass';
import { Icon } from '../components/kit/Icon';
import { Pill, tapHaptic } from '../components/kit/Pill';
import { ProfileChart } from '../components/kit/ProfileChart';
import { BIKE_TONES, RoadBike } from '../components/bike/RoadBike';
import { Screen } from '../components/Screen';
import { WhySheet } from '../components/WhySheet';
import type { PowerConnectionState } from '../ble/cps';
import { useHeartRate } from '../state/HeartRateContext';
import { useHistory } from '../state/HistoryContext';
import { usePowerMeter } from '../state/PowerMeterContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkout } from '../state/WorkoutContext';
import { track } from '../storage/cloud';
import { lastRideLine } from './lastRide';
import { ink, radius, type, surface } from '../theme/tokens';

function SensorTile({
  kind,
  state,
  value,
  name,
  onPress,
  testID,
}: {
  kind: 'power' | 'heart';
  state: PowerConnectionState;
  value: number | null;
  name: string | null;
  onPress: () => void;
  testID: string;
}) {
  const connected = state === 'connected';
  const busy = state === 'scanning' || state === 'connecting';
  const title = kind === 'power' ? 'Power meter' : 'Heart rate';
  const unit = kind === 'power' ? 'W' : 'bpm';
  const accent = kind === 'power' ? ink.ember : ink.rose;
  const soft = kind === 'power' ? ink.emberSoft : ink.roseSoft;
  const status = connected ? 'Live' : busy ? (state === 'scanning' ? 'Searching' : 'Connecting') : 'Connect';
  return (
    <Pressable
      onPress={() => {
        tapHaptic('light');
        onPress();
      }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${connected ? `Connected${name ? ` to ${name}` : ''}. ${value == null ? 'No reading' : `${value} ${unit}`}` : status}`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: connected ? soft : ink.grouped }]}>
          <Icon name={kind === 'power' ? 'bolt' : 'heart'} size={16} color={connected ? accent : '#8E8E93'} />
        </View>
        {connected ? (
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        ) : null}
      </View>
      {connected ? (
        <View style={styles.tileBody}>
          <Text style={styles.tileValue}>
            {value == null ? '—' : value}
            <Text style={styles.tileUnit}> {unit}</Text>
          </Text>
          <Text style={styles.tileName} numberOfLines={1}>
            {name ?? title}
          </Text>
        </View>
      ) : (
        <View style={styles.tileBody}>
          <Text style={styles.tileTitle}>{title}</Text>
          <Text style={[styles.tileAction, busy && { color: ink.secondary }]}>{status}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function HomeScreen() {
  const { settings } = useSettings();
  const auth = useAuth();
  const engine = useWorkout();
  const meter = usePowerMeter();
  const heart = useHeartRate();
  const history = useHistory();
  const [whyOpen, setWhyOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const dock = Math.max(insets.bottom, 12);
  const workout = engine.state.workout;
  const minutes = Math.round(workout.totalMs / 60_000);
  const lastRide = useMemo(() => lastRideLine(history.sessions, settings.reps), [history.sessions, settings.reps]);
  const powerOn = meter.connectionState === 'connected';
  const heartOn = heart.connectionState === 'connected';
  const anyConnected = powerOn || heartOn;

  const start = async () => {
    await engine.start();
    router.push('/workout');
    void track('workout_start', {
      ftp_watts: settings.ftpWatts,
      sets: settings.sets,
      reps: settings.reps,
      work_sec: settings.workSec,
      recover_sec: settings.recoverSec,
    });
  };

  const meterName = meter.phase.phase === 'connected' ? meter.phase.name : null;
  const heartName = heart.phase.phase === 'connected' ? heart.phase.name : null;

  return (
    <Screen>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,90,31,0)', 'rgba(255,90,31,0.10)', 'rgba(255,90,31,0.22)']}
        locations={[0, 0.6, 1]}
        style={styles.glow}
      />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: dock + START_H + 28 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.wordmark} accessibilityRole="header" accessibilityLabel="30 15">
            30<Text style={{ color: ink.ember }}>/</Text>15
          </Text>
          <View style={styles.headerActions}>
            {auth.user ? (
              <AccountBadge name={auth.user.name ?? auth.user.email ?? 'Signed in'} size={44} testID="home-account-badge" />
            ) : null}
            <GlassButton icon="sliders" onPress={() => router.push('/settings')} accessibilityLabel="Settings" testID="open-settings" />
          </View>
        </View>

        <FtpChangeNotice testID="home-ftp-change" />

        <View style={styles.session}>
          <View style={styles.sessionTop}>
            <View>
              <Text style={styles.caption}>
                Today’s session · <Text style={type.tabular}>{minutes} min</Text>
              </Text>
              <Text style={styles.sessionTitle}>
                {settings.sets} × {settings.reps}
              </Text>
            </View>
            <RoadBike width={128} tone={BIKE_TONES.ember} wheelPeriodMs={2600} style={styles.bike} />
          </View>
          <ProfileChart segments={workout.segments} />
        </View>

        <View style={styles.tiles}>
          <SensorTile
            kind="power"
            state={meter.connectionState}
            value={meter.live?.watts ?? null}
            name={meterName}
            onPress={() => router.push('/power')}
            testID="home-power"
          />
          <SensorTile
            kind="heart"
            state={heart.connectionState}
            value={heart.live?.bpm ?? null}
            name={heartName}
            onPress={() => router.push('/heart')}
            testID="home-hr"
          />
        </View>
        {!(powerOn && heartOn) ? (
          <View style={styles.nudge} testID="home-sensor-nudge">
            <Text style={styles.optional}>
              {!anyConnected
                ? 'Sensors are optional. Start any time. With a heart-rate monitor or power meter, 30/15 tracks your progress, learns your FTP, and sharpens your VO₂max estimate.'
                : heartOn
                  ? 'Add a power meter and 30/15 can track your hard-rep power and learn your FTP.'
                  : 'Add a heart-rate monitor to measure efficiency and sharpen your VO₂max estimate.'}
            </Text>
            <Pressable
              onPress={() => router.push('/sensors')}
              accessibilityRole="link"
              hitSlop={10}
              testID="home-sensor-guide"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.nudgeLink}>What can I connect?</Text>
            </Pressable>
          </View>
        ) : null}

        {lastRide ? (
          <Pressable
            onPress={() => router.push('/history')}
            accessibilityRole="button"
            accessibilityLabel={`Last ride. ${lastRide}`}
            testID="home-last-ride"
            style={({ pressed }) => [styles.lastRide, pressed && styles.pressed]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.lastTitle}>Last ride</Text>
              <Text style={styles.lastDetail} numberOfLines={1}>
                {lastRide}
              </Text>
            </View>
            <Icon name="chevron" size={14} color={ink.faint} />
          </Pressable>
        ) : null}

        {lastRide ? (
          <Pressable
            onPress={() => router.push('/progress')}
            accessibilityRole="button"
            testID="home-progress"
            style={({ pressed }) => [styles.lastRide, pressed && styles.pressed]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.lastTitle}>Progress</Text>
              <Text style={styles.lastDetail} numberOfLines={1}>
                {auth.user ? 'Trends, weekly load and personal records' : 'Sign in to see your trends'}
              </Text>
            </View>
            <Icon name="chevron" size={14} color={ink.faint} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => setWhyOpen(true)}
          testID="why-3015"
          accessibilityRole="button"
          style={({ pressed }) => [styles.why, pressed && styles.pressed]}
        >
          <Icon name="info" size={16} color={ink.secondary} />
          <Text style={styles.whyText}>Why 30/15</Text>
        </Pressable>
      </ScrollView>

      {/* Start floats above the page. Content fades out beneath it instead of ending at a hard line. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(16,6,2,0)', 'rgba(16,6,2,0.86)', 'rgba(16,6,2,0.96)']}
        locations={[0, 0.55, 1]}
        style={[styles.edge, { height: dock + START_H + 56 }]}
      />
      <View style={[styles.dock, { paddingBottom: dock }]} pointerEvents="box-none">
        <Pill label="Start" height={START_H} onPress={() => void start()} testID="start" accessibilityHint="Starts the warm-up. Sensors are optional." />
      </View>
      <WhySheet visible={whyOpen} onClose={() => setWhyOpen(false)} />
    </Screen>
  );
}

const START_H = 62;

const styles = StyleSheet.create({
  glow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 340 },
  scroll: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 6 },
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  wordmark: { color: ink.text, ...type.largeTitle, letterSpacing: -0.8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.7 },
  session: { marginTop: 22, ...surface.card, borderRadius: radius.card, padding: 20, paddingBottom: 18, gap: 18 },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  caption: { color: ink.secondary, ...type.callout },
  sessionTitle: { color: ink.text, fontSize: 44, lineHeight: 48, fontWeight: '600', letterSpacing: -1.5, ...type.tabular },
  bike: { marginTop: 4, marginRight: -6 },
  tiles: { flexDirection: 'row', gap: 12, marginTop: 12 },
  tile: { flex: 1, ...surface.card, borderRadius: radius.tile, padding: 16, minHeight: 112, gap: 14, justifyContent: 'space-between' },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ink.signal },
  liveText: { color: ink.signal, fontSize: 12, fontWeight: '600' },
  tileBody: { gap: 2 },
  tileValue: { color: ink.text, ...type.metric },
  tileUnit: { color: ink.secondary, fontSize: 15, fontWeight: '500', letterSpacing: 0 },
  tileName: { color: ink.secondary, ...type.caption },
  tileTitle: { color: ink.text, ...type.headline },
  tileAction: { color: ink.emberText, ...type.caption, fontWeight: '600' },
  optional: { color: '#8E8E93', ...type.caption, textAlign: 'center', paddingHorizontal: 12 },
  nudge: { alignItems: 'center', gap: 6, marginTop: 14 },
  nudgeLink: { color: ink.emberText, ...type.caption, fontWeight: '600', paddingVertical: 4 },
  lastRide: {
    marginTop: 12,
    ...surface.card,
    borderRadius: radius.row,
    minHeight: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lastTitle: { color: ink.text, fontSize: 15, fontWeight: '600' },
  lastDetail: { color: ink.secondary, ...type.caption, ...type.tabular },
  why: { marginTop: 10, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  whyText: { color: ink.secondary, ...type.callout },
});
