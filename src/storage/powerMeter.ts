import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseSavedPowerMeter, type SavedPowerMeter } from './powerMeterRecord';

const KEY = '@thirtyfifteen/power_meter/v1';

export type { SavedPowerMeter };

export async function loadSavedPowerMeter(): Promise<SavedPowerMeter | null> {
  try {
    return parseSavedPowerMeter(await AsyncStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export async function savePowerMeter(meter: SavedPowerMeter): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: meter.id, name: meter.name }));
  } catch {
    // the ride does not wait on storage
  }
}

export async function clearSavedPowerMeter(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
