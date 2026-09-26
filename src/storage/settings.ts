import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS } from '../workout/defaults';
import type { WorkoutSettings } from '../types';

const KEY = '@thirtyfifteen/settings/v1';
const ONBOARD_KEY = '@thirtyfifteen/ftp_onboarded/v1';

export async function loadSettings(): Promise<WorkoutSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<WorkoutSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: WorkoutSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export async function hasCompletedFtpOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARD_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markFtpOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARD_KEY, '1');
  } catch {
    // ignore
  }
}

/** Remove saved settings and the FTP prompt flag. The next save writes defaults. */
export async function clearStoredSettings(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY, ONBOARD_KEY]);
  } catch {
    // ignore
  }
}
