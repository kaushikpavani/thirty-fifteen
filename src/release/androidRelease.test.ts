import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { AndroidManifest } from '@expo/config-plugins';
import { AUTH_CALLBACK_URI } from '../auth/redirect.ts';

const require = createRequire(import.meta.url);
const { AndroidConfig } = require('@expo/config-plugins') as typeof import('@expo/config-plugins');
const { shapeAndroidReleaseManifest, shapeAndroidSystemBars } = require('../../plugins/androidManifest.js') as {
  shapeAndroidReleaseManifest: (manifest: AndroidManifest) => AndroidManifest;
  shapeAndroidSystemBars: <T>(
    styles: T,
    assign: (xml: T, spec: { add: boolean; parent: { name: string }; name: string; value: string }) => T,
    parent: { name: string },
  ) => T;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function permission(manifest: AndroidManifest, name: string) {
  return manifest.manifest['uses-permission']?.find((item) => item.$['android:name'] === name)?.$ as
    | Record<string, string>
    | undefined;
}

test('the Android release manifest caps location, marks scan neverForLocation, and does not require BLE', () => {
  const manifest = {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      queries: [],
      'uses-permission': [
        { $: { 'android:name': 'android.permission.BLUETOOTH_SCAN' } },
        { $: { 'android:name': 'android.permission.ACCESS_FINE_LOCATION' } },
        { $: { 'android:name': 'android.permission.ACCESS_BACKGROUND_LOCATION' } },
      ],
      'uses-feature': [{ $: { 'android:name': 'android.hardware.bluetooth_le', 'android:required': 'true' as const } }],
    },
  } as AndroidManifest;
  const shaped = shapeAndroidReleaseManifest(manifest);
  const scan = permission(shaped, 'android.permission.BLUETOOTH_SCAN');
  assert.equal(scan?.['android:usesPermissionFlags'], 'neverForLocation');
  assert.equal(permission(shaped, 'android.permission.BLUETOOTH_CONNECT')?.['android:name'], 'android.permission.BLUETOOTH_CONNECT');
  assert.equal(permission(shaped, 'android.permission.ACCESS_FINE_LOCATION')?.['android:maxSdkVersion'], '30');
  assert.equal(permission(shaped, 'android.permission.ACCESS_COARSE_LOCATION')?.['android:maxSdkVersion'], '30');
  assert.equal(permission(shaped, 'android.permission.BLUETOOTH')?.['android:maxSdkVersion'], '30');
  assert.equal(permission(shaped, 'android.permission.ACCESS_BACKGROUND_LOCATION'), undefined);
  const feature = shaped.manifest['uses-feature']?.find((item) => item.$['android:name'] === 'android.hardware.bluetooth_le');
  assert.equal(feature?.$['android:required'], 'false');
  const legacy = shaped.manifest['uses-permission-sdk-23']?.find(
    (item) => item.$['android:name'] === 'android.permission.ACCESS_FINE_LOCATION',
  );
  assert.equal((legacy?.$ as Record<string, string>)['android:maxSdkVersion'], '30');
});

test('Android system bars are light icons on the dark window', () => {
  const parent = AndroidConfig.Styles.getAppThemeGroup();
  const styles = shapeAndroidSystemBars({ resources: {} }, AndroidConfig.Styles.assignStylesValue, parent);
  const group = AndroidConfig.Styles.getStylesGroupAsObject(styles, parent);
  assert.equal(group?.['android:windowLightStatusBar'], 'false');
  assert.equal(group?.['android:windowLightNavigationBar'], 'false');
  assert.equal(group?.['android:statusBarColor'], '#070708');
  assert.equal(group?.['android:navigationBarColor'], '#070708');
});

test('Android app config matches the iOS bundle id and does not rename iOS', () => {
  const app = readJson('app.json') as {
    expo: {
      name?: string;
      scheme?: string;
      version?: string;
      owner?: string;
      ios?: { infoPlist?: { CFBundleDisplayName?: string }; bundleIdentifier?: string };
      android?: {
        package?: string;
        versionCode?: number;
        allowBackup?: boolean;
        backgroundColor?: string;
        blockedPermissions?: string[];
        permissions?: string[];
        adaptiveIcon?: { foregroundImage?: string; backgroundImage?: string; monochromeImage?: string; backgroundColor?: string };
        intentFilters?: { data?: { scheme?: string; host?: string }[] }[];
      };
      plugins?: unknown[];
    };
  };
  assert.equal(app.expo.owner, 'pavanikaushik');
  assert.equal(app.expo.version, '1.0.0');
  assert.equal(app.expo.name, 'ThirtyFifteen');
  assert.equal(app.expo.ios?.infoPlist?.CFBundleDisplayName, '30/15');
  assert.equal(app.expo.ios?.bundleIdentifier, 'com.kaushikpavani.thirtyfifteen');
  assert.equal(app.expo.android?.package, 'com.kaushikpavani.thirtyfifteen');
  assert.equal(app.expo.android?.versionCode, 1);
  assert.equal(app.expo.android?.allowBackup, false);
  assert.equal(app.expo.android?.backgroundColor, '#070708');
  assert.equal(app.expo.android?.permissions, undefined);
  assert.ok(app.expo.android?.blockedPermissions?.includes('android.permission.ACCESS_BACKGROUND_LOCATION'));
  assert.ok(app.expo.android?.blockedPermissions?.includes('android.permission.RECORD_AUDIO'));
  assert.equal(app.expo.android?.adaptiveIcon?.foregroundImage, './assets/android-icon-foreground.png');
  assert.equal(app.expo.android?.adaptiveIcon?.backgroundImage, './assets/android-icon-background.png');
  assert.equal(app.expo.android?.adaptiveIcon?.monochromeImage, './assets/android-icon-monochrome.png');
  assert.equal(app.expo.android?.adaptiveIcon?.backgroundColor, '#070708');
  const filter = app.expo.android?.intentFilters?.[0]?.data?.[0];
  assert.equal(filter?.scheme, 'thirtyfifteen');
  assert.equal(filter?.host, 'auth-callback');
  assert.equal(AUTH_CALLBACK_URI, 'thirtyfifteen://auth-callback');
  assert.equal(app.expo.scheme, 'thirtyfifteen');

  const plugins = app.expo.plugins ?? [];
  assert.deepEqual(
    plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === './plugins/withAndroidLabel'),
    ['./plugins/withAndroidLabel', '30/15 Coach'],
  );
  assert.ok(plugins.includes('./plugins/withAndroidRelease'));
  for (const file of [
    'assets/android-icon-foreground.png',
    'assets/android-icon-background.png',
    'assets/android-icon-monochrome.png',
    'assets/splash-icon.png',
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
});

test('EAS adds an Android APK preview and an Android App Bundle without changing the iOS submit', () => {
  const eas = readJson('eas.json') as {
    cli?: { appVersionSource?: string };
    build?: Record<string, { android?: { buildType?: string }; ios?: { simulator?: boolean }; autoIncrement?: boolean }>;
    submit?: { production?: { ios?: { ascAppId?: string; appleTeamId?: string }; android?: unknown } };
  };
  assert.equal(eas.cli?.appVersionSource, 'remote');
  assert.equal(eas.build?.preview?.android?.buildType, 'apk');
  assert.equal(eas.build?.preview?.autoIncrement, true);
  assert.equal(eas.build?.production?.android?.buildType, 'app-bundle');
  assert.equal(eas.build?.production?.autoIncrement, true);
  assert.equal(eas.build?.development?.android?.buildType, 'apk');
  assert.equal(eas.build?.development?.ios, undefined);
  assert.equal(eas.submit?.production?.ios?.appleTeamId, '9R7M4ATZJ8');
  assert.equal(eas.submit?.production?.ios?.ascAppId, '6835283825');
  assert.equal(eas.submit?.production?.android, undefined);
});

test('Android shipping notes cover Play setup and do not use banned words', () => {
  const doc = fs.readFileSync(path.join(root, 'docs/ANDROID.md'), 'utf8');
  assert.match(doc, /com\.kaushikpavani\.thirtyfifteen/);
  assert.match(doc, /30\/15 Coach/);
  assert.match(doc, /pavanikaushiks-team/);
  assert.match(doc, /preview/);
  assert.match(doc, /app-bundle|AAB/);
  assert.match(doc, /12 testers/);
  assert.match(doc, /14 days/);
  assert.match(doc, /thirtyfifteen:\/\/auth-callback/);
  assert.match(doc, /SHA-1/);
  assert.match(doc, /Data safety/);
  assert.match(doc, /neverForLocation/);
  assert.match(doc, /foreground service/i);
  assert.doesNotMatch(doc, /honest/i);
  assert.doesNotMatch(doc, /\bPro\b|subscription/i);
  const session = fs.readFileSync(path.join(root, 'src/audio/session.ts'), 'utf8');
  assert.match(session, /workoutInterruptionMode/);
  assert.doesNotMatch(session, /platform === 'android'\) return 'doNotMix'|Platform\.OS === 'android'\) return 'doNotMix'/);
});
