import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export type BleGate = 'web' | 'expo-go';

export function bleGate(): BleGate | null {
  if (Platform.OS === 'web') return 'web';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expo-go';
  return null;
}

export function bleGateCopy(
  reason: BleGate | 'unavailable' | 'bluetooth-off' | 'permission' | 'no-devices' | 'no-power' | 'no-hr',
): {
  title: string;
  body: string;
} {
  switch (reason) {
    case 'web':
      return {
        title: 'Not in the browser',
        body: 'A browser tab cannot read a power meter or a heart rate broadcast. Use the iOS app. The ride still starts. Live watts and heart rate stay blank until a sensor sends them.',
      };
    case 'expo-go':
      return {
        title: 'Needs a development build',
        body: 'Expo Go has no Bluetooth stack. Live watts and heart rate need a dev build. The ride still starts. Nothing is invented.',
      };
    case 'bluetooth-off':
      return {
        title: 'Bluetooth is off',
        body: 'Turn the radio on, then scan again. The ride still starts without a sensor.',
      };
    case 'permission':
      return {
        title: 'Bluetooth permission denied',
        body: 'Allow Bluetooth for 30/15 in system settings, then scan again.',
      };
    case 'no-devices':
      return {
        title: 'Nothing in range',
        body: 'Wake the sensor, then scan again. Live numbers stay off until it sends them.',
      };
    case 'no-power':
      return {
        title: 'No power service',
        body: 'That device does not expose the cycling power service or FTMS. Live watts stay off.',
      };
    case 'no-hr':
      return {
        title: 'No heart rate service',
        body: 'That device does not expose the heart rate service. Live heart rate stays off.',
      };
    default:
      return {
        title: 'Bluetooth unavailable',
        body: 'This install cannot open the radio. Use a development build, then connect again.',
      };
  }
}
