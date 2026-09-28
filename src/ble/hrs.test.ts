import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HRS_MEASUREMENT_UUID,
  HRS_SERVICE_UUID,
  HR_SCAN_UUIDS,
  heartRateHint,
  heartRateLabel,
  heartRateTarget,
  shouldReportHeartRate,
} from './hrs.ts';
import { parseSavedHeartRate } from '../storage/heartRateRecord.ts';

test('heart rate scan asks for the standard service and measurement', () => {
  assert.equal(HR_SCAN_UUIDS[0], HRS_SERVICE_UUID);
  assert.match(HRS_SERVICE_UUID, /180d/i);
  assert.match(HRS_MEASUREMENT_UUID, /2a37/i);
  assert.equal(heartRateTarget([{ uuid: '1818' }]), null);
  assert.equal(heartRateTarget([{ uuid: '0000180d-0000-1000-8000-00805f9b34fb' }])?.characteristicId, '2a37');
});

test('open scans ignore a power-only advertisement', () => {
  assert.equal(shouldReportHeartRate({ serviceUUIDs: ['180d'] }, 'open'), true);
  assert.equal(shouldReportHeartRate({ serviceUUIDs: ['1818'] }, 'open'), false);
  assert.equal(shouldReportHeartRate({ serviceUUIDs: null }, 'filtered'), true);
  assert.equal(shouldReportHeartRate({ serviceUUIDs: null }, 'open'), false);
});

test('hints never invent a beat', () => {
  assert.match(heartRateHint('connected') ?? '', /only when the watch sends a beat/);
  assert.equal(heartRateHint('connected', { liveBpm: 142 }), null);
  assert.equal(heartRateHint('connected', { liveBpm: 0 }), null);
  assert.match(heartRateHint('disconnected') ?? '', /only when a watch sends them/);
  assert.equal(heartRateLabel({ id: 'AA:BB:CC:11', name: ' Fenix 7 ' }), 'Fenix 7');
  assert.equal(heartRateLabel({ id: 'AA:BB:CC:11', name: null }), 'Heart rate CC11');
});

test('the last heart rate sensor survives a round trip', () => {
  assert.deepEqual(parseSavedHeartRate(JSON.stringify({ id: 'watch-1', name: 'Fenix' })), {
    id: 'watch-1',
    name: 'Fenix',
  });
  assert.equal(parseSavedHeartRate(JSON.stringify({ name: 'Fenix' })), null);
  assert.equal(parseSavedHeartRate(''), null);
  assert.deepEqual(parseSavedHeartRate(JSON.stringify({ id: 'watch-1' })), {
    id: 'watch-1',
    name: 'Heart rate',
  });
});
