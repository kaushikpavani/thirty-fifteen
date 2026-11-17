/**
 * Android Bluetooth permission plan.
 * Android 12+ (API 31) uses BLUETOOTH_SCAN and BLUETOOTH_CONNECT.
 * Older versions still require location permission before a scan.
 * The manifest marks the scan `neverForLocation` and caps location at API 30.
 * Start does not call this module.
 */

export const BLE_SCAN = 'android.permission.BLUETOOTH_SCAN';
export const BLE_CONNECT = 'android.permission.BLUETOOTH_CONNECT';
export const BLE_FINE_LOCATION = 'android.permission.ACCESS_FINE_LOCATION';
export const BLE_COARSE_LOCATION = 'android.permission.ACCESS_COARSE_LOCATION';

export type BleGrant = 'granted' | 'denied' | 'blocked';

export type BleRationale = { title: string; body: string; allow: string; skip: string };

export type BleDeniedCopy = { title: string; body: string; settings: string; dismiss: string };

export function androidRuntimeBlePermissions(api: number): string[] {
  if (!Number.isFinite(api) || api >= 31) return [BLE_SCAN, BLE_CONNECT];
  if (api <= 28) return [BLE_FINE_LOCATION, BLE_COARSE_LOCATION];
  return [BLE_FINE_LOCATION];
}

export function bleGrantSummary(needed: readonly string[], grants: Record<string, string>): BleGrant {
  let missing = false;
  let blocked = false;
  for (const name of needed) {
    if (grants[name] === 'granted') continue;
    missing = true;
    if (grants[name] === 'never_ask_again') blocked = true;
  }
  if (!missing) return 'granted';
  return blocked ? 'blocked' : 'denied';
}

export function androidBleRationale(api: number): BleRationale {
  const legacy = Number.isFinite(api) && api < 31;
  return {
    title: 'Connect a sensor?',
    body: legacy
      ? '30/15 Coach reads cycling power and heart rate from a meter or strap you choose. This Android version asks for location permission before a Bluetooth scan. The app does not read your location. The ride still starts if you skip this.'
      : '30/15 Coach reads cycling power and heart rate from a meter or strap you choose. Bluetooth is not used for location. The ride still starts if you skip this.',
    allow: 'Allow',
    skip: 'Not now',
  };
}

export function androidBleDenied(blocked: boolean): BleDeniedCopy {
  return {
    title: blocked ? 'Bluetooth is blocked' : 'Bluetooth was not allowed',
    body: blocked
      ? '30/15 Coach can ride without a sensor. To connect a meter or strap later, allow Bluetooth in system settings.'
      : '30/15 Coach can ride without a sensor. Watts and heart rate stay blank until you allow Bluetooth.',
    settings: 'Open settings',
    dismiss: 'Keep riding',
  };
}

export async function resolveAndroidBleAccess(input: {
  api: number;
  prompt: boolean;
  check: (names: readonly string[]) => Promise<Record<string, string>>;
  request: (names: readonly string[]) => Promise<Record<string, string>>;
  explain: (copy: BleRationale) => Promise<boolean>;
  explainDenied: (copy: BleDeniedCopy) => Promise<boolean>;
  openSettings: () => Promise<void>;
}): Promise<'granted' | 'denied'> {
  const needed = androidRuntimeBlePermissions(input.api);
  if (bleGrantSummary(needed, await input.check(needed)) === 'granted') return 'granted';
  if (!input.prompt) return 'denied';
  const allow = await input.explain(androidBleRationale(input.api));
  if (!allow) return 'denied';
  const after = bleGrantSummary(needed, await input.request(needed));
  if (after === 'granted') return 'granted';
  const open = await input.explainDenied(androidBleDenied(after === 'blocked'));
  if (open) await input.openSettings();
  return 'denied';
}
