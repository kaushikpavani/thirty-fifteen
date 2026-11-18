import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  androidBleDenied,
  androidBleRationale,
  androidRuntimeBlePermissions,
  bleGrantSummary,
  BLE_CONNECT,
  BLE_FINE_LOCATION,
  BLE_SCAN,
  resolveAndroidBleAccess,
} from './androidPermissions.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('Android 12+ asks for scan and connect, and older Android asks for location', () => {
  assert.deepEqual(androidRuntimeBlePermissions(34), [BLE_SCAN, BLE_CONNECT]);
  assert.deepEqual(androidRuntimeBlePermissions(31), [BLE_SCAN, BLE_CONNECT]);
  assert.deepEqual(androidRuntimeBlePermissions(30), [BLE_FINE_LOCATION]);
  assert.deepEqual(androidRuntimeBlePermissions(29), [BLE_FINE_LOCATION]);
  assert.deepEqual(androidRuntimeBlePermissions(28), [BLE_FINE_LOCATION, 'android.permission.ACCESS_COARSE_LOCATION']);
  assert.deepEqual(androidRuntimeBlePermissions(Number.NaN), [BLE_SCAN, BLE_CONNECT]);
});

test('a grant is blocked only when Android will not ask again', () => {
  const needed = [BLE_SCAN, BLE_CONNECT];
  assert.equal(bleGrantSummary(needed, { [BLE_SCAN]: 'granted', [BLE_CONNECT]: 'granted' }), 'granted');
  assert.equal(bleGrantSummary(needed, { [BLE_SCAN]: 'granted', [BLE_CONNECT]: 'denied' }), 'denied');
  assert.equal(bleGrantSummary(needed, { [BLE_SCAN]: 'never_ask_again', [BLE_CONNECT]: 'denied' }), 'blocked');
  assert.equal(bleGrantSummary(needed, {}), 'denied');
});

test('the rationale says the ride still starts, and a denial can open settings', async () => {
  const modern = androidBleRationale(34);
  const legacy = androidBleRationale(29);
  assert.match(modern.body, /ride still starts/);
  assert.match(modern.body, /not used for location/);
  assert.match(legacy.body, /does not read your location/);
  assert.match(legacy.body, /ride still starts/);
  assert.equal(androidBleDenied(false).dismiss, 'Keep riding');
  assert.match(androidBleDenied(true).body, /system settings/);

  const calls: string[] = [];
  const denied = await resolveAndroidBleAccess({
    api: 34,
    prompt: true,
    check: async () => ({ [BLE_SCAN]: 'denied', [BLE_CONNECT]: 'denied' }),
    request: async () => {
      calls.push('request');
      return { [BLE_SCAN]: 'never_ask_again', [BLE_CONNECT]: 'denied' };
    },
    explain: async () => {
      calls.push('explain');
      return true;
    },
    explainDenied: async () => {
      calls.push('denied');
      return true;
    },
    openSettings: async () => {
      calls.push('settings');
    },
  });
  assert.equal(denied, 'denied');
  assert.deepEqual(calls, ['explain', 'request', 'denied', 'settings']);
});

test('an already granted radio does not explain, and a quiet reconnect does not prompt', async () => {
  let explained = 0;
  const granted = await resolveAndroidBleAccess({
    api: 33,
    prompt: true,
    check: async () => ({ [BLE_SCAN]: 'granted', [BLE_CONNECT]: 'granted' }),
    request: async () => {
      throw new Error('should not request');
    },
    explain: async () => {
      explained += 1;
      return true;
    },
    explainDenied: async () => true,
    openSettings: async () => undefined,
  });
  assert.equal(granted, 'granted');
  assert.equal(explained, 0);

  const quiet = await resolveAndroidBleAccess({
    api: 33,
    prompt: false,
    check: async () => ({ [BLE_SCAN]: 'denied', [BLE_CONNECT]: 'granted' }),
    request: async () => {
      throw new Error('quiet reconnect must not request');
    },
    explain: async () => {
      throw new Error('quiet reconnect must not explain');
    },
    explainDenied: async () => true,
    openSettings: async () => undefined,
  });
  assert.equal(quiet, 'denied');
});

test('skipping the rationale never opens the system dialog', async () => {
  const outcome = await resolveAndroidBleAccess({
    api: 34,
    prompt: true,
    check: async () => ({ [BLE_SCAN]: 'denied', [BLE_CONNECT]: 'denied' }),
    request: async () => {
      throw new Error('Not now must not request');
    },
    explain: async () => false,
    explainDenied: async () => true,
    openSettings: async () => undefined,
  });
  assert.equal(outcome, 'denied');
});

test('both sensor clients share one permission helper and do not ask on their own', () => {
  for (const rel of ['src/ble/client.ts', 'src/ble/hrClient.ts']) {
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.match(source, /ensureAndroidBlePermission\(\{ prompt: options\?\.prompt \}\)/);
    assert.doesNotMatch(source, /PermissionsAndroid/);
  }
  const home = fs.readFileSync(path.join(root, 'src/screens/HomeScreen.tsx'), 'utf8');
  const startFn = home.slice(home.indexOf('const start = async'), home.indexOf('const meterName'));
  assert.doesNotMatch(startFn, /ensureAndroidBlePermission|createBleClient|createHrClient/);
});
