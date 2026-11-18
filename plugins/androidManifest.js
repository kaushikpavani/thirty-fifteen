/**
 * Android release manifest and system bars.
 * Location stays capped at API 30. Android 12+ scan is neverForLocation.
 * BLE hardware is optional: a phone without it can still start a ride.
 */

const SCAN = 'android.permission.BLUETOOTH_SCAN';
const CONNECT = 'android.permission.BLUETOOTH_CONNECT';
const FINE = 'android.permission.ACCESS_FINE_LOCATION';
const COARSE = 'android.permission.ACCESS_COARSE_LOCATION';
const BACKGROUND_LOCATION = 'android.permission.ACCESS_BACKGROUND_LOCATION';
const LEGACY_BLUETOOTH = 'android.permission.BLUETOOTH';
const LEGACY_ADMIN = 'android.permission.BLUETOOTH_ADMIN';
const BLE_FEATURE = 'android.hardware.bluetooth_le';
const BAR = '#070708';

function upsert(list, extra) {
  const name = extra['android:name'] ?? '';
  const next = { $: extra };
  const index = list.findIndex((item) => item.$['android:name'] === name);
  if (index >= 0) list[index] = next;
  else list.push(next);
}

function ensureList(manifest, key) {
  const current = manifest.manifest[key];
  if (!Array.isArray(current)) manifest.manifest[key] = [];
  return manifest.manifest[key];
}

function shapeAndroidReleaseManifest(manifest) {
  manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  const uses = ensureList(manifest, 'uses-permission');
  upsert(uses, {
    'android:name': LEGACY_BLUETOOTH,
    'android:maxSdkVersion': '30',
    'tools:replace': 'android:maxSdkVersion',
  });
  upsert(uses, {
    'android:name': LEGACY_ADMIN,
    'android:maxSdkVersion': '30',
    'tools:replace': 'android:maxSdkVersion',
  });
  upsert(uses, {
    'android:name': SCAN,
    'android:usesPermissionFlags': 'neverForLocation',
    'tools:targetApi': '31',
    'tools:replace': 'android:usesPermissionFlags',
  });
  upsert(uses, {
    'android:name': CONNECT,
    'tools:targetApi': '31',
  });
  for (const name of [FINE, COARSE]) {
    upsert(uses, {
      'android:name': name,
      'android:maxSdkVersion': '30',
      'tools:replace': 'android:maxSdkVersion',
    });
  }
  manifest.manifest['uses-permission'] = uses.filter((item) => item.$['android:name'] !== BACKGROUND_LOCATION);

  const legacy = ensureList(manifest, 'uses-permission-sdk-23');
  for (const name of [FINE, COARSE]) {
    upsert(legacy, {
      'android:name': name,
      'android:maxSdkVersion': '30',
      'tools:replace': 'android:maxSdkVersion',
    });
  }

  const features = manifest.manifest['uses-feature'] ?? [];
  manifest.manifest['uses-feature'] = features;
  const existing = features.find((item) => item.$['android:name'] === BLE_FEATURE);
  if (existing) {
    existing.$['android:required'] = 'false';
    existing.$['tools:replace'] = 'android:required';
  } else {
    features.push({
      $: {
        'android:name': BLE_FEATURE,
        'android:required': 'false',
        'tools:replace': 'android:required',
      },
    });
  }
  return manifest;
}

function shapeAndroidSystemBars(styles, assign, parent) {
  const items = [
    ['android:windowLightStatusBar', 'false'],
    ['android:windowLightNavigationBar', 'false'],
    ['android:statusBarColor', BAR],
    ['android:navigationBarColor', BAR],
  ];
  return items.reduce((xml, [name, value]) => assign(xml, { add: true, parent, name, value }), styles);
}

module.exports = { shapeAndroidReleaseManifest, shapeAndroidSystemBars };
