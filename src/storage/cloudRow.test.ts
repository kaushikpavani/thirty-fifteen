import assert from 'node:assert/strict';
import test from 'node:test';
import { createId, isInstallId } from './id.ts';
import {
  clientColumnMissing,
  cloudDuplicate,
  cloudExtensionMissing,
  feedbackDeviceProblem,
  legacyWorkoutSessionWrite,
  trimOutbox,
  workoutRowsForRetry,
  workoutSessionWrite,
} from './cloudRow.ts';
import type { WorkoutRecord } from '../types.ts';

const record: WorkoutRecord = {
  id: 'ride-1',
  startedAt: '2026-09-26T08:00:00.000Z',
  endedAt: '2026-09-26T08:40:00.000Z',
  durationMs: 2_400_000,
  plannedDurationMs: 2_400_000,
  ftpWatts: 125,
  hardWatts: 150,
  easyWatts: 63,
  completed: true,
  completionPct: 100,
};

test('install ids from createId fit the device key', () => {
  assert.equal(isInstallId(createId()), true);
  assert.equal(isInstallId('short'), false);
  assert.equal(isInstallId('has space'), false);
});

test('a phone session is manual and has no external id', () => {
  const row = workoutSessionWrite(record, 'user-1', 'device-1');
  assert.equal(row.source, 'manual');
  assert.equal(row.external_id, null);
  assert.equal(row.device_id, 'device-1');
  assert.equal(row.user_id, 'user-1');
  assert.equal(row.ftp_watts, 125);
  assert.equal(row.hard_watts, 150);
  assert.equal(row.easy_watts, 63);
  const legacy = legacyWorkoutSessionWrite(row);
  assert.equal('device_id' in legacy, false);
  assert.equal('source' in legacy, false);
  assert.equal(legacy.id, 'ride-1');
});

test('older workout tables retry without the new columns', () => {
  const row = workoutSessionWrite(record, 'user-1', 'device-1');
  const missing = workoutRowsForRetry(
    [row],
    "Could not find the 'device_id' column of 'workout_sessions' in the schema cache",
  );
  assert.ok(missing);
  assert.equal('device_id' in missing[0], false);
  assert.equal(cloudExtensionMissing("Could not find the 'source' column of 'workout_sessions' in the schema cache"), true);

  const fk = workoutRowsForRetry(
    [row],
    'insert or update on table "workout_sessions" violates foreign key constraint "workout_sessions_device_id_fkey"',
  );
  assert.ok(fk);
  assert.equal('device_id' in fk[0] && fk[0].device_id, null);
  assert.equal('source' in fk[0] && fk[0].source, 'manual');
  assert.equal(workoutRowsForRetry([row], 'Failed to fetch'), null);
});

test('a retried outbox row is not a new failure', () => {
  assert.equal(cloudDuplicate('duplicate key value violates unique constraint "app_events_client_event_id_key"'), true);
  assert.equal(cloudDuplicate('Failed to fetch'), false);
  assert.equal(clientColumnMissing('client_id', "Could not find the 'client_id' column of 'app_feedback' in the schema cache"), true);
  assert.equal(clientColumnMissing('client_event_id', 'Failed to fetch'), false);
  assert.deepEqual(trimOutbox([1, 2, 3], 2), [1, 2]);
});

test('feedback can fall back when device_id is not in the table yet', () => {
  assert.equal(
    feedbackDeviceProblem("Could not find the 'device_id' column of 'app_feedback' in the schema cache"),
    true,
  );
  assert.equal(feedbackDeviceProblem('insert or update violates foreign key constraint "app_feedback_device_id_fkey"'), true);
  assert.equal(feedbackDeviceProblem('Failed to fetch'), false);
});
