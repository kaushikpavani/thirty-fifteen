import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { describeBleGate, type BleGateReason } from './gateCopy';

export type BleGate = 'web' | 'expo-go';

export function bleGate(): BleGate | null {
  if (Platform.OS === 'web') return 'web';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expo-go';
  return null;
}

export function bleGateCopy(reason: BleGateReason): { title: string; body: string } {
  return describeBleGate(reason, Platform.OS);
}
