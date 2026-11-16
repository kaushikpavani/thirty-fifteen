import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { IOSConfig } = require('@expo/config-plugins') as {
  IOSConfig: { XcodeUtils: { sanitizedName: (name: string) => string } };
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('the iOS app config is a phone-only TestFlight build', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')) as {
    expo: {
      owner?: string;
      version?: string;
      ios?: {
        supportsTablet?: boolean;
        bundleIdentifier?: string;
        buildNumber?: string;
        usesAppleSignIn?: boolean;
        config?: { usesNonExemptEncryption?: boolean };
        privacyManifests?: {
          NSPrivacyTracking?: boolean;
          NSPrivacyAccessedAPITypes?: { NSPrivacyAccessedAPIType?: string; NSPrivacyAccessedAPITypeReasons?: string[] }[];
        };
        infoPlist?: Record<string, unknown>;
      };
      plugins?: unknown[];
    };
  };
  const ios = app.expo.ios;
  assert.ok(ios);
  assert.equal(app.expo.owner, 'pavanikaushik');
  assert.equal(app.expo.version, '1.0.0');
  assert.equal(ios.supportsTablet, false);
  assert.equal(ios.bundleIdentifier, 'com.kaushikpavani.thirtyfifteen');
  assert.equal(ios.usesAppleSignIn, true);
  assert.equal(ios.config?.usesNonExemptEncryption, false);
  assert.equal(ios.privacyManifests?.NSPrivacyTracking, false);
  const reasons = ios.privacyManifests?.NSPrivacyAccessedAPITypes ?? [];
  assert.equal(reasons.some((row) => row.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryUserDefaults' && row.NSPrivacyAccessedAPITypeReasons.includes('CA92.1')), true);
  assert.equal(ios.buildNumber, undefined);
  const modes = ios.infoPlist?.UIBackgroundModes;
  assert.deepEqual(modes, ['audio', 'bluetooth-central']);
  const bluetooth = ios.infoPlist?.NSBluetoothAlwaysUsageDescription;
  assert.equal(bluetooth, '30/15 reads cycling power and heart rate from your sensors.');
  assert.equal(typeof bluetooth, 'string');
  assert.equal(String(bluetooth).includes('\n'), false);
  assert.equal(ios.infoPlist?.NSBluetoothPeripheralUsageDescription, undefined);

  const plugins = app.expo.plugins ?? [];
  const ble = plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'react-native-ble-plx',
  ) as [string, { modes?: string[]; bluetoothAlwaysPermission?: string; isBackgroundEnabled?: boolean; neverForLocation?: boolean }] | undefined;
  assert.ok(ble);
  assert.deepEqual(ble[1].modes, ['central']);
  assert.equal(ble[1].isBackgroundEnabled, true);
  assert.equal(ble[1].neverForLocation, true);
  assert.equal(ble[1].bluetoothAlwaysPermission, bluetooth);
  assert.ok(plugins.includes('expo-apple-authentication'));

  const audio = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-audio') as
    | [string, { microphonePermission?: boolean | string; recordAudioAndroid?: boolean; enableBackgroundRecording?: boolean; enableBackgroundPlayback?: boolean }]
    | undefined;
  assert.ok(audio);
  assert.equal(audio[1].microphonePermission, false);
  assert.equal(audio[1].recordAudioAndroid, false);
  assert.equal(audio[1].enableBackgroundRecording, false);
  assert.equal(audio[1].enableBackgroundPlayback, true);

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  const names = Object.keys(pkg.dependencies ?? {});
  assert.equal(names.includes('expo-notifications'), false);
  assert.equal(names.includes('expo-apple-authentication'), true);
  assert.match(pkg.scripts?.['eas-build-pre-install'] ?? '', /corepack disable/);
});

test('EAS keeps the iOS build number remotely and submits to team 9R7M4ATZJ8', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8')) as {
    cli?: { appVersionSource?: string };
    build?: Record<string, { autoIncrement?: boolean; environment?: string; developmentClient?: boolean; distribution?: string }>;
    submit?: { production?: { ios?: { ascAppId?: string; appleTeamId?: string } } };
  };
  assert.equal(eas.cli?.appVersionSource, 'remote');
  assert.equal(eas.build?.development?.developmentClient, true);
  assert.equal(eas.build?.development?.distribution, 'internal');
  assert.equal(eas.build?.development?.environment, 'development');
  assert.equal(eas.build?.preview?.distribution, 'internal');
  assert.equal(eas.build?.preview?.environment, 'preview');
  assert.equal(eas.build?.preview?.autoIncrement, true);
  assert.equal(eas.build?.production?.environment, 'production');
  assert.equal(eas.build?.production?.autoIncrement, true);
  assert.equal(eas.submit?.production?.ios?.appleTeamId, '9R7M4ATZJ8');
  assert.equal(eas.submit?.production?.ios?.ascAppId, '6835283825');
});

test('the Xcode target is a non-numeric name and the home screen stays 30/15', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')) as {
    expo: {
      name?: string;
      extra?: { eas?: { projectId?: string } };
      web?: { name?: string };
      splash?: unknown;
      ios?: { bundleIdentifier?: string; infoPlist?: { CFBundleDisplayName?: string } };
      android?: { package?: string };
      plugins?: unknown[];
    };
  };
  const name = app.expo.name ?? '';
  const nativeName = IOSConfig.XcodeUtils.sanitizedName(name);
  assert.equal(nativeName, 'ThirtyFifteen');
  assert.match(nativeName, /^[A-Za-z][A-Za-z0-9]*$/);
  assert.equal(/^\d+$/.test(nativeName), false);
  assert.equal(app.expo.ios?.infoPlist?.CFBundleDisplayName, '30/15');
  assert.equal(app.expo.ios?.bundleIdentifier, 'com.kaushikpavani.thirtyfifteen');
  assert.equal(app.expo.android?.package, 'com.kaushikpavani.thirtyfifteen');
  assert.equal(app.expo.web?.name, '30/15');
  assert.equal(app.expo.extra?.eas?.projectId, '5fe5855e-1f9e-417f-b31d-abf10c597958');
  assert.equal(app.expo.splash, undefined);

  const plugins = app.expo.plugins ?? [];
  const label = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === './plugins/withAndroidLabel');
  assert.deepEqual(label, ['./plugins/withAndroidLabel', '30/15']);

  const splash = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen') as
    | [string, { image?: string; resizeMode?: string; backgroundColor?: string; imageWidth?: number; enableFullScreenImage_legacy?: boolean }]
    | undefined;
  assert.ok(splash);
  assert.equal(splash[1].image, './assets/splash-icon.png');
  assert.equal(splash[1].resizeMode, 'contain');
  assert.equal(splash[1].backgroundColor, '#070708');
  assert.equal(splash[1].imageWidth, 200);
  assert.equal(splash[1].enableFullScreenImage_legacy, true);
});
