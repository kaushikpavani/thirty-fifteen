import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CPS_SERVICE_UUID,
  FTMS_SERVICE_UUID,
  POWER_SCAN_UUIDS,
  connectionStateFor,
  connectionStateLabel,
  deviceLabel,
  powerMeterHint,
  powerTargets,
  radioBlock,
  shouldReportDevice,
} from './cps.ts';
import { parseSavedPowerMeter } from '../storage/powerMeterRecord.ts';

const CPS = '00001818-0000-1000-8000-00805f9b34fb';
const FTMS = '00001826-0000-1000-8000-00805f9b34fb';

test('scan filter asks for cycling power before FTMS', () => {
  assert.equal(POWER_SCAN_UUIDS[0], CPS_SERVICE_UUID);
  assert.equal(POWER_SCAN_UUIDS[1], FTMS_SERVICE_UUID);
  assert.match(POWER_SCAN_UUIDS[0], /1818/);
  assert.match(POWER_SCAN_UUIDS[1], /1826/);
});

test('CPS is chosen before FTMS when a peripheral exposes both', () => {
  const targets = powerTargets([{ uuid: FTMS }, { uuid: '1818' }]);
  assert.deepEqual(
    targets.map((target) => target.kind),
    ['cps', 'ftms'],
  );
  assert.equal(targets[0]?.characteristicId, '2a63');
  assert.equal(targets[1]?.characteristicId, '2ad2');
  assert.equal(powerTargets([{ uuid: CPS }])[0]?.kind, 'cps');
  assert.equal(powerTargets([{ uuid: FTMS }])[0]?.kind, 'ftms');
  assert.deepEqual(powerTargets([{ uuid: '0000180d-0000-1000-8000-00805f9b34fb' }]), []);
});

test('discovery prefers advertised power services over a bare name', () => {
  assert.equal(shouldReportDevice({ serviceUUIDs: [CPS] }, 'open'), true);
  assert.equal(shouldReportDevice({ serviceUUIDs: [FTMS] }, 'filtered'), true);
  assert.equal(shouldReportDevice({ serviceUUIDs: null }, 'open'), false);
  assert.equal(shouldReportDevice({ serviceUUIDs: ['180d'] }, 'open'), false);
  assert.equal(shouldReportDevice({ serviceUUIDs: null }, 'filtered'), true);
  assert.equal(shouldReportDevice({ serviceUUIDs: [], overflowServiceUUIDs: [CPS] }, 'open'), true);
});

test('connection state covers the radio phases', () => {
  assert.equal(connectionStateFor({ phase: 'idle' }), 'disconnected');
  assert.equal(connectionStateFor({ phase: 'list' }), 'disconnected');
  assert.equal(connectionStateFor({ phase: 'scanning' }), 'scanning');
  assert.equal(connectionStateFor({ phase: 'connecting' }), 'connecting');
  assert.equal(connectionStateFor({ phase: 'connected' }), 'connected');
  assert.equal(connectionStateFor({ phase: 'blocked', reason: 'no-devices' }), 'disconnected');
  assert.equal(connectionStateFor({ phase: 'blocked', reason: 'no-power' }), 'disconnected');
  assert.equal(connectionStateFor({ phase: 'blocked', reason: 'bluetooth-off' }), 'bluetoothUnavailable');
  assert.equal(connectionStateFor({ phase: 'blocked', reason: 'permission' }), 'bluetoothUnavailable');
  assert.equal(connectionStateFor({ phase: 'blocked', reason: 'expo-go' }), 'bluetoothUnavailable');
  assert.equal(connectionStateFor({ phase: 'blocked', reason: 'web' }), 'bluetoothUnavailable');
  assert.equal(connectionStateFor({ phase: 'blocked', reason: 'unavailable' }), 'bluetoothUnavailable');
  assert.equal(connectionStateLabel('bluetoothUnavailable'), 'Bluetooth unavailable');
  assert.equal(connectionStateLabel('scanning'), 'Scanning');
  assert.equal(connectionStateLabel('disconnected'), 'Disconnected');
  assert.equal(connectionStateLabel('connecting'), 'Connecting');
  assert.equal(connectionStateLabel('connected'), 'Connected');
});

test('radio state maps to the right block', () => {
  assert.equal(radioBlock('PoweredOn'), null);
  assert.equal(radioBlock('PoweredOff'), 'bluetooth-off');
  assert.equal(radioBlock('Unauthorized'), 'permission');
  assert.equal(radioBlock('Unsupported'), 'unavailable');
  assert.equal(radioBlock('Unknown'), 'unavailable');
});

test('hints tell the rider to pedal and never invent watts', () => {
  assert.match(powerMeterHint('scanning') ?? '', /Pedal the crank/);
  assert.match(powerMeterHint('connected') ?? '', /only when the meter sends them/);
  assert.equal(powerMeterHint('connected', { liveWatts: 0 }), null);
  assert.equal(powerMeterHint('connected', { liveWatts: 186 }), null);
  assert.equal(powerMeterHint('bluetoothUnavailable'), null);
  assert.match(powerMeterHint('disconnected', { devices: 1 }) ?? '', /Tap a meter/);
  assert.equal(deviceLabel({ id: 'ABCD1234', name: '  Quarq  ' }), 'Quarq');
  assert.equal(deviceLabel({ id: 'AA:BB:CC:DD', name: null }), 'Power meter CCDD');
});

test('start is not gated on power or heart rate', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const home = fs.readFileSync(path.join(root, 'screens/HomeScreen.tsx'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'screens/SettingsScreen.tsx'), 'utf8');
  const active = fs.readFileSync(path.join(root, 'screens/ActiveScreen.tsx'), 'utf8');
  const power = fs.readFileSync(path.join(root, 'app/power.tsx'), 'utf8');
  assert.match(home, /Power meter/);
  assert.match(home, /Heart rate/);
  assert.match(home, /testID="start"/);
  assert.match(home, /Why 30\/15/);
  assert.doesNotMatch(home, />FTP<|edit-ftp|disabled=\{/);
  assert.match(settings, /Power meter/);
  assert.match(settings, /Heart rate/);
  assert.match(settings, /Workout Sets/);
  assert.match(power, /PowerMeterPanel variant="settings"/);
  assert.match(active, /testID="live-watts"/);
  assert.match(active, /testID="live-bpm"/);
  assert.match(active, /testID=\{running \? 'pause' : 'resume'\}/);
  assert.match(active, /FINISH_TITLE/);
  const craft = fs.readFileSync(path.join(root, 'workout/craft.ts'), 'utf8');
  assert.match(craft, /You did it\./);
  assert.match(craft, /Great focus\. Strong work\./);
  assert.doesNotMatch(active, /testID="shorten"|testID="skip"|testID="restart"/);
  assert.doesNotMatch(`${home}\n${settings}\n${active}`, /honest/i);
  assert.equal(connectionStateFor({ phase: 'blocked', reason: 'no-hr' }), 'disconnected');
});

test('saved peripheral id survives a round trip and rejects junk', () => {
  assert.deepEqual(parseSavedPowerMeter(JSON.stringify({ id: 'periph-1', name: 'SRAM' })), {
    id: 'periph-1',
    name: 'SRAM',
  });
  assert.deepEqual(parseSavedPowerMeter(JSON.stringify({ id: 'periph-1' })), {
    id: 'periph-1',
    name: 'Power meter',
  });
  assert.equal(parseSavedPowerMeter(null), null);
  assert.equal(parseSavedPowerMeter(''), null);
  assert.equal(parseSavedPowerMeter('{'), null);
  assert.equal(parseSavedPowerMeter(JSON.stringify({ name: 'SRAM' })), null);
  assert.equal(parseSavedPowerMeter(JSON.stringify({ id: '   ' })), null);
});
