import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Atmosphere } from '../components/Atmosphere';
import { FtpOnboardingModal } from '../components/FtpOnboardingModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useSettings } from '../state/SettingsContext';
import { useWorkout } from '../state/WorkoutContext';
import { colors } from '../theme/colors';
import { markFtpOnboardingDone } from '../storage/settings';
import { sessionSummary } from '../workout/builder';
import { derivedWatts, TIP } from '../workout/defaults';

export function HomeScreen() {
  const { settings, update } = useSettings();
  const engine = useWorkout();
  const reduceMotion = useReduceMotion();
  const [ftpOpen, setFtpOpen] = useState(false);
  const summary = sessionSummary(settings);
  const watts = derivedWatts(settings.ftpWatts, settings.hardPct, settings.easyPct);

  const saveFtp = async (ftp: number) => {
    await update({ ...settings, ftpWatts: ftp });
    await markFtpOnboardingDone();
    setFtpOpen(false);
  };

  const start = async () => {
    await engine.start();
    router.push('/workout');
  };

  return (
    <Screen bottom>
      <Atmosphere variant="rest" reduceMotion={reduceMotion} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Text style={styles.brand}>30/15</Text>
        </View>

        <Pressable
          style={styles.hero}
          onPress={() => setFtpOpen(true)}
          testID="edit-ftp"
        >
          <Text style={styles.kicker}>FTP</Text>
          <Text style={styles.ftp}>{settings.ftpWatts}</Text>
          <Text style={styles.unit}>watts</Text>
        </Pressable>

        <View style={styles.split}>
          <View style={styles.splitCol}>
            <Text style={[styles.splitLabel, { color: colors.hard }]}>HARD</Text>
            <Text style={styles.splitValue}>{watts.hard}</Text>
            <Text style={styles.splitHint}>{settings.hardPct}%</Text>
          </View>
          <View style={styles.splitCol}>
            <Text style={[styles.splitLabel, { color: colors.easy }]}>EASY</Text>
            <Text style={styles.splitValue}>{watts.easy}</Text>
            <Text style={styles.splitHint}>{settings.easyPct}%</Text>
          </View>
        </View>

        <Text style={styles.structure}>
          {settings.sets} × {settings.reps} · {settings.workSec}/{settings.recoverSec} · ~{summary.totalMin} min
        </Text>
        <Text style={styles.tip}>{TIP}</Text>

        <View style={styles.goWrap}>
          <PrimaryButton label="Start" alive onPress={() => void start()} testID="start" />
        </View>

        <View style={styles.links}>
          <Pressable onPress={() => router.push('/settings')} testID="open-settings">
            <Text style={styles.link}>Settings</Text>
          </Pressable>
        </View>
      </ScrollView>

      <FtpOnboardingModal
        visible={ftpOpen}
        initialFtp={settings.ftpWatts}
        hardPct={settings.hardPct}
        easyPct={settings.easyPct}
        mode="edit"
        onConfirm={(ftp) => {
          void saveFtp(ftp);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 20,
  },
  top: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    color: '#FFB020',
    letterSpacing: 3,
    fontSize: 13,
    fontWeight: '600',
  },
  hero: {
    marginTop: 48,
    marginBottom: 28,
  },
  kicker: {
    color: colors.textDim,
    letterSpacing: 2.4,
    fontSize: 12,
    fontWeight: '600',
  },
  ftp: {
    color: colors.text,
    fontSize: 96,
    lineHeight: 100,
    fontWeight: '200',
    letterSpacing: -3,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  unit: {
    color: colors.textMuted,
    fontSize: 18,
    marginTop: -4,
  },
  split: {
    flexDirection: 'row',
    gap: 24,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  splitCol: { flex: 1, gap: 2, paddingTop: 14 },
  splitLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.6,
  },
  splitValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  splitHint: { color: colors.textDim, fontSize: 13 },
  structure: {
    marginTop: 28,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  tip: {
    marginTop: 8,
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 20,
  },
  goWrap: { marginTop: 28 },
  links: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  link: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 8,
  },
});
