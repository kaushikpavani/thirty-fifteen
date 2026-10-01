import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { HistoryProvider, useHistory } from '../state/HistoryContext';
import { HeartRateProvider } from '../state/HeartRateContext';
import { PowerMeterProvider } from '../state/PowerMeterContext';
import { SettingsProvider, useSettings } from '../state/SettingsContext';
import { WorkoutProvider } from '../state/WorkoutContext';
import { noteAppOpen } from '../storage/cloud';
import { scheduleSync } from '../storage/sync';
import { colors } from '../theme/colors';
import { FtpAutoAdjuster } from '../components/FtpAutoAdjuster';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.frame}>
        <View style={styles.column}>
          <SettingsProvider>
            <AuthProvider>
              <HistoryProvider>
                <WorkoutProvider>
                  <PowerMeterProvider>
                    <HeartRateProvider>
                      <RootNavigator />
                    </HeartRateProvider>
                  </PowerMeterProvider>
                </WorkoutProvider>
              </HistoryProvider>
            </AuthProvider>
          </SettingsProvider>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const settings = useSettings();
  const auth = useAuth();
  const history = useHistory();
  useEffect(() => {
    if (!auth.ready) return;
    noteAppOpen();
    scheduleSync();
  }, [auth.ready]);
  useEffect(() => {
    if (!auth.justSignedIn) return;
    auth.clearJustSignedIn();
    const { ageYears, sex, weightLb, profilePromptSeen } = settings.settings;
    if (!profilePromptSeen && ageYears == null && sex == null && weightLb == null) {
      router.push('/profile-onboarding');
    }
  }, [auth, settings.settings]);
  if (!settings.ready || !auth.ready || !history.ready) {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootMark}>30/15</Text>
      </View>
    );
  }

  return (
    <>
    <FtpAutoAdjuster />
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="home" />
      <Stack.Screen name="workout" options={{ gestureEnabled: false }} />
      <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="history/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="progress" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="sound" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="credits" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="fitness" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="profile-onboarding" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      <Stack.Screen name="sensors" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="power" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="heart" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="feedback" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="auth-callback" options={{ animation: 'none' }} />
    </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 430 : undefined,
    backgroundColor: colors.bg,
  },
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootMark: {
    color: colors.textDim,
    letterSpacing: 3,
    fontSize: 13,
    fontWeight: '600',
  },
});
