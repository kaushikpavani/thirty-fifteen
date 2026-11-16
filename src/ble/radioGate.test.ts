import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { shouldOpenRadio } from './radioGate.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('the radio stays closed on first launch and opens when the rider connects', () => {
  assert.equal(shouldOpenRadio({ savedId: null, userAsked: false }), false);
  assert.equal(shouldOpenRadio({ savedId: undefined, userAsked: false }), false);
  assert.equal(shouldOpenRadio({ savedId: '', userAsked: false }), false);
  assert.equal(shouldOpenRadio({ savedId: null, userAsked: true }), true);
  assert.equal(shouldOpenRadio({ savedId: 'meter-1', userAsked: false }), true);
});

test('launch restores a saved sensor only through the radio gate', () => {
  const power = fs.readFileSync(path.join(root, 'src/state/PowerMeterContext.tsx'), 'utf8');
  const heart = fs.readFileSync(path.join(root, 'src/state/HeartRateContext.tsx'), 'utf8');
  const layout = fs.readFileSync(path.join(root, 'src/app/_layout.tsx'), 'utf8');
  for (const source of [power, heart]) {
    assert.match(source, /shouldOpenRadio\(\{ savedId: saved\?\.id \?\? null, userAsked: false \}\)/);
  }
  assert.doesNotMatch(layout, /createBleClient|BleManager|expo-notifications|requestPermissions/);
  const manager = fs.readFileSync(path.join(root, 'src/ble/manager.ts'), 'utf8');
  assert.match(manager, /RESTORE_ID = 'thirtyfifteen-ble'/);
  assert.match(manager, /restoreStateIdentifier: RESTORE_ID/);
  assert.match(manager, /restoreStateFunction/);
});
