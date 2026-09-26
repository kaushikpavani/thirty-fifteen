import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export type BleGate = 'web' | 'expo-go';

export function bleGate(): BleGate | null {
  if (Platform.OS === 'web') return 'web';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expo-go';
  return null;
}

export function bleGateCopy(reason: BleGate | 'unavailable' | 'bluetooth-off' | 'permission' | 'no-devices' | 'no-power'): {
  title: string;
  body: string;
} {
  switch (reason) {
    case 'web':
      return {
        title: 'Not in the browser',
        body: 'A browser tab cannot read a power meter. Use the iOS app. Targets still work. Live watts are never invented.',
      };
    case 'expo-go':
      return {
        title: 'Needs a development build',
        body: 'Expo Go has no Bluetooth stack. Live watts need a dev build with react-native-ble-plx. Targets still work. We will not fake watts.',
      };
    case 'bluetooth-off':
      return {
        title: 'Bluetooth is off',
        body: 'Turn the radio on, then scan again. Until a meter connects, you only get target watts.',
      };
    case 'permission':
      return {
        title: 'Bluetooth permission denied',
        body: 'Allow Bluetooth for 30/15 in system settings, then scan again.',
      };
    case 'no-devices':
      return {
        title: 'Nothing in range',
        body: 'Wake the trainer or power meter and put it in pairing mode. Scan again.',
      };
    case 'no-power':
      return {
        title: 'No power service',
        body: 'That device does not expose FTMS or the cycling power service. Live watts stay off.',
      };
    default:
      return {
        title: 'Bluetooth unavailable',
        body: 'This install cannot open the radio. Use a development build, then connect again.',
      };
  }
}
