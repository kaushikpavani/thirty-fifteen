import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { SensorChip } from '../components/SensorChip';
import { WhySheet } from '../components/WhySheet';
import { Screen } from '../components/Screen';
import { useHeartRate } from '../state/HeartRateContext';
import { usePowerMeter } from '../state/PowerMeterContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkout } from '../state/WorkoutContext';
import { colors } from '../theme/colors';
import { track } from '../storage/cloud';

export function HomeScreen() {
  const { settings } = useSettings();
  const engine = useWorkout();
  const meter = usePowerMeter();
  const heart = useHeartRate();
  const { width } = useWindowDimensions();
  const [whyOpen, setWhyOpen] = useState(false);
  const startSize = Math.min(248, Math.round(width * 0.62));

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

  const watts = meter.live?.watts;
  const bpm = heart.live?.bpm;

  return (
    <Screen bottom>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>30/15</Text>

        <View style={styles.chips}>
          <SensorChip
            kind="power"
            title="Power meter"
            state={meter.connectionState}
            live={watts != null}
            value={watts == null ? '--' : String(watts)}
            unit="watts"
            onPress={() => router.push('/power')}
            testID="home-power"
          />
          <SensorChip
            kind="heart"
            title="Heart rate"
            state={heart.connectionState}
            live={bpm != null}
            value={bpm == null ? '--' : String(bpm)}
            unit="bpm"
            onPress={() => router.push('/heart')}
            testID="home-hr"
          />
        </View>

        <View style={styles.startWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start"
            onPress={() => void start()}
            testID="start"
            style={({ pressed }) => [
              styles.start,
              { width: startSize, height: startSize, borderRadius: startSize / 2 },
              pressed && styles.startPressed,
            ]}
          >
            <Text style={styles.startLabel}>Start ›</Text>
          </Pressable>
        </View>

        <View style={styles.group}>
          <Pressable
            onPress={() => setWhyOpen(true)}
            testID="why-3015"
            accessibilityRole="link"
            style={styles.row}
          >
            <Text style={styles.rowLabel}>Why 30/15</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <View style={styles.hairline} />
          <Pressable onPress={() => router.push('/settings')} testID="open-settings" style={styles.row}>
            <Text style={styles.rowLabel}>Settings</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
      <WhySheet visible={whyOpen} onClose={() => setWhyOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  title: {
    marginTop: 8,
    color: colors.white,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  chips: { marginTop: 22, gap: 10 },
  startWrap: { alignItems: 'center', marginTop: 28, marginBottom: 28 },
  start: {
    backgroundColor: '#12151C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  startPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  startLabel: { color: colors.white, fontSize: 32, fontWeight: '700', letterSpacing: -0.4 },
  group: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: { color: colors.white, fontSize: 17, fontWeight: '500' },
  chevron: { color: '#0A84FF', fontSize: 22, fontWeight: '500' },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginLeft: 16,
  },
});
