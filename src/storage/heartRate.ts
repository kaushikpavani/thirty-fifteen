import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseSavedHeartRate, type SavedHeartRate } from './heartRateRecord';

const KEY = '@thirtyfifteen/heart_rate/v1';

export type { SavedHeartRate };

export async function loadSavedHeartRate(): Promise<SavedHeartRate | null> {
  try {
    return parseSavedHeartRate(await AsyncStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export async function saveHeartRate(sensor: SavedHeartRate): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: sensor.id, name: sensor.name }));
  } catch {
    // the ride does not wait on storage
  }
}

export async function clearSavedHeartRate(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
