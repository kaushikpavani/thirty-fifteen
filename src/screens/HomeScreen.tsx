import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FtpOnboardingModal } from '../components/FtpOnboardingModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useHistory } from '../state/HistoryContext';
import { usePowerMeter } from '../state/PowerMeterContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkout } from '../state/WorkoutContext';
import { colors } from '../theme/colors';
import { hasCompletedFtpOnboarding, markFtpOnboardingDone } from '../storage/settings';
import { sessionSummary } from '../workout/builder';
import { derivedWatts, TIP } from '../workout/defaults';

export function HomeScreen() {
  const { settings, update } = useSettings();
  const history = useHistory();
  const meter = usePowerMeter();
  const engine = useWorkout();
  const [ftpOpen, setFtpOpen] = useState(false);
  const [ftpMode, setFtpMode] = useState<'onboard' | 'edit'>('onboard');
  const summary = sessionSummary(settings);
  const watts = derivedWatts(settings.ftpWatts, settings.hardPct, settings.easyPct);

  useEffect(() => {
    let cancelled = false;
    void hasCompletedFtpOnboarding().then((done) => {
      if (cancelled || done) return;
      setFtpMode('onboard');
      setFtpOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Text style={styles.brand}>30/15</Text>
          {history.streak > 0 ? (
            <Text style={styles.streak}>
              {history.streak} {history.streak === 1 ? 'DAY' : 'DAYS'}
            </Text>
          ) : null}
        </View>

        <Pressable
          style={styles.hero}
          onPress={() => {
            setFtpMode('edit');
            setFtpOpen(true);
          }}
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

        {meter.live ? (
          <Text style={styles.live} testID="home-live-watts">
            Live {meter.live.watts} W
            {meter.live.speedKph != null ? ` · ${meter.live.speedKph.toFixed(1)} km/h` : ''}
          </Text>
        ) : null}

        <View style={styles.goWrap}>
          <PrimaryButton label="GO" onPress={() => void start()} testID="go" />
        </View>

        <View style={styles.links}>
          <Pressable onPress={() => router.push('/history')} testID="open-history">
            <Text style={styles.link}>History</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} testID="open-settings">
            <Text style={styles.link}>Settings</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/about')} testID="open-about">
            <Text style={styles.link}>Science</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/feedback')} testID="open-feedback">
            <Text style={styles.link}>Feedback</Text>
          </Pressable>
        </View>
      </ScrollView>

      <FtpOnboardingModal
        visible={ftpOpen}
        initialFtp={settings.ftpWatts}
        hardPct={settings.hardPct}
        easyPct={settings.easyPct}
        mode={ftpMode}
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
    color: colors.textDim,
    letterSpacing: 3,
    fontSize: 13,
    fontWeight: '600',
  },
  streak: {
    color: colors.textMuted,
    letterSpacing: 1.6,
    fontSize: 12,
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
  live: {
    marginTop: 18,
    color: colors.easy,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
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
