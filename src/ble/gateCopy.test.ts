import assert from 'node:assert/strict';
import test from 'node:test';
import { describeBleGate } from './gateCopy.ts';

test('iOS permission copy stays the existing sentence', () => {
  assert.deepEqual(describeBleGate('permission', 'ios'), {
    title: 'Bluetooth permission denied',
    body: 'Allow Bluetooth for 30/15 in system settings, then scan again.',
  });
});

test('Android permission denial tells the rider the ride still starts', () => {
  const copy = describeBleGate('permission', 'android');
  assert.equal(copy.title, 'Bluetooth was not allowed');
  assert.match(copy.body, /ride still starts/);
  assert.match(copy.body, /30\/15 Coach/);
});

test('a missing sensor service does not change by platform', () => {
  assert.equal(describeBleGate('no-power', 'android').title, 'No power service');
  assert.equal(describeBleGate('no-hr', 'ios').title, 'No heart rate service');
  assert.match(describeBleGate('bluetooth-off', 'android').body, /ride still starts/);
});
