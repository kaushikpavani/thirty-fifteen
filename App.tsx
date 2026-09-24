import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FtpOnboardingModal } from './src/components/FtpOnboardingModal';
import { useWorkoutEngine } from './src/hooks/useWorkoutEngine';
import { AboutScreen } from './src/screens/AboutScreen';
import { ActiveScreen } from './src/screens/ActiveScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import {
  hasCompletedFtpOnboarding,
  loadSettings,
  markFtpOnboardingDone,
  saveSettings,
} from './src/storage/settings';
import { colors } from './src/theme/colors';
import type { AppScreen, WorkoutSettings } from './src/types';
import { DEFAULT_SETTINGS } from './src/workout/defaults';

export default function App() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<WorkoutSettings>(DEFAULT_SETTINGS);
  const [screen, setScreen] = useState<AppScreen>('home');
  const [showFtpModal, setShowFtpModal] = useState(false);
  const [ftpModalMode, setFtpModalMode] = useState<'onboard' | 'edit'>('onboard');

  const engine = useWorkoutEngine(settings);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loaded, onboarded] = await Promise.all([
        loadSettings(),
        hasCompletedFtpOnboarding(),
      ]);
      if (cancelled) return;
      setSettings(loaded);
      if (!onboarded) {
        setFtpModalMode('onboard');
        setShowFtpModal(true);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: WorkoutSettings) => {
    setSettings(next);
    await saveSettings(next);
  }, []);

  const onFtpConfirm = useCallback(
    async (ftp: number) => {
      const next = { ...settings, ftpWatts: ftp };
      await persist(next);
      await markFtpOnboardingDone();
      setShowFtpModal(false);
    },
    [persist, settings],
  );

  const beginWorkout = useCallback(async () => {
    setScreen('active');
    await engine.start();
  }, [engine]);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {screen === 'home' && (
        <HomeScreen
          settings={settings}
          onStart={beginWorkout}
          onSettings={() => setScreen('settings')}
          onAbout={() => setScreen('about')}
          onEditFtp={() => {
            setFtpModalMode('edit');
            setShowFtpModal(true);
          }}
        />
      )}
      {screen === 'active' && (
        <ActiveScreen
          settings={settings}
          state={engine.state}
          onPause={engine.pause}
          onResume={engine.resume}
          onStop={() => {
            engine.stop();
            setScreen('home');
          }}
          onDoneHome={() => {
            engine.stop();
            setScreen('home');
          }}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onChange={(next) => {
            void persist(next);
          }}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'about' && <AboutScreen onBack={() => setScreen('home')} />}

      <FtpOnboardingModal
        visible={showFtpModal}
        initialFtp={settings.ftpWatts}
        hardPct={settings.hardPct}
        easyPct={settings.easyPct}
        mode={ftpModalMode}
        onConfirm={(ftp) => {
          void onFtpConfirm(ftp);
        }}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
