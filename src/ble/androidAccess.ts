import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { resolveAndroidBleAccess, type BleDeniedCopy, type BleRationale } from './androidPermissions';

function apiLevel(): number {
  const version = Platform.Version;
  return typeof version === 'number' ? version : parseInt(String(version), 10);
}

function ask(copy: BleRationale): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      copy.title,
      copy.body,
      [
        { text: copy.skip, style: 'cancel', onPress: () => resolve(false) },
        { text: copy.allow, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function askDenied(copy: BleDeniedCopy): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      copy.title,
      copy.body,
      [
        { text: copy.dismiss, style: 'cancel', onPress: () => resolve(false) },
        { text: copy.settings, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

type AndroidPermission = (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];

function asPermission(name: string): AndroidPermission {
  return name as AndroidPermission;
}

async function readGrants(names: readonly string[]): Promise<Record<string, string>> {
  const grants: Record<string, string> = {};
  for (const name of names) {
    grants[name] = (await PermissionsAndroid.check(asPermission(name)))
      ? PermissionsAndroid.RESULTS.GRANTED
      : PermissionsAndroid.RESULTS.DENIED;
  }
  return grants;
}

async function requestGrants(names: readonly string[]): Promise<Record<string, string>> {
  if (names.length === 1) {
    const name = names[0] ?? '';
    const value = await PermissionsAndroid.request(asPermission(name));
    return { [name]: value };
  }
  const result = await PermissionsAndroid.requestMultiple(names.map(asPermission));
  return result;
}

/**
 * Ask for the Bluetooth (or legacy location) grant before the radio opens.
 * A declined or blocked result throws `permission`. The ride is not involved.
 * `prompt: false` fails quietly, so a reconnect does not cover the workout with a dialog.
 */
export async function ensureAndroidBlePermission(options?: { prompt?: boolean }): Promise<void> {
  if (Platform.OS !== 'android') return;
  const outcome = await resolveAndroidBleAccess({
    api: apiLevel(),
    prompt: options?.prompt !== false,
    check: readGrants,
    request: requestGrants,
    explain: ask,
    explainDenied: askDenied,
    openSettings: () => Linking.openSettings(),
  });
  if (outcome !== 'granted') throw new Error('permission');
}
