import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../auth/AuthContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkout } from '../state/WorkoutContext';
import { syncSettings } from '../storage/settingsCloud';
import type { WorkoutSettings } from '../types';

const DEBOUNCE_MS = 1500;

/**
 * Keeps the rider's settings backed up with their account and brings them
 * back on a new install: on sign-in, on every app open, and shortly after
 * any change. Never during a ride, so the session can't change under the
 * rider. Renders nothing.
 */
export function SettingsSync() {
  const auth = useAuth();
  const { ready, settings, update } = useSettings();
  const engine = useWorkout();
  const riding = engine.state.status === 'running' || engine.state.status === 'paused';
  const userId = auth.user?.id ?? null;

  const latest = useRef({ settings, riding, userId, ready });
  useLayoutEffect(() => {
    latest.current = { settings, riding, userId, ready };
  });

  /** One pass. Returns the settings as they stand afterwards. */
  const run = useCallback(async (): Promise<WorkoutSettings> => {
    const before = latest.current;
    if (!before.ready || !before.userId || before.riding) return before.settings;
    const result = await syncSettings(before.settings);
    const now = latest.current;
    // Signed out, switched account or started a ride while this was in flight: leave the phone as it is.
    if (result.kind !== 'synced' || !result.apply || now.userId !== before.userId || now.riding) return now.settings;
    const next = { ...now.settings, ...result.apply };
    latest.current = { ...now, settings: next };
    await update(next, { fromCloud: true });
    return next;
  }, [update]);

  // Sign-in (including the first one after a reinstall) and app start.
  const justSignedIn = auth.justSignedIn;
  const clearJustSignedIn = auth.clearJustSignedIn;
  useEffect(() => {
    if (!ready || !auth.ready) return;
    if (!justSignedIn) {
      if (userId) void run();
      return;
    }
    // Restore first, then decide whether to ask for age, sex and weight: a returning rider already told us.
    clearJustSignedIn();
    void run().then((after) => {
      const { ageYears, sex, weightLb, profilePromptSeen } = after;
      if (!profilePromptSeen && ageYears == null && sex == null && weightLb == null) router.push('/profile-onboarding');
    });
  }, [ready, auth.ready, userId, justSignedIn, clearJustSignedIn, run]);

  // Shortly after any change, and when a ride ends.
  useEffect(() => {
    if (!ready || !userId || riding) return;
    const timer = setTimeout(() => void run(), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ready, userId, riding, settings, run]);

  // Coming back to the app: pick up changes made on another phone.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => sub.remove();
  }, [run]);

  return null;
}
