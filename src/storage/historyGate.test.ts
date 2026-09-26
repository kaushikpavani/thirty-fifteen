import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldUploadSession } from './historyGate.ts';
import { shouldFlushOutboxes } from './syncPlan.ts';

test('a signed-out or unwired phone does not upload a session', () => {
  const ended = '2026-09-26T08:40:00.000Z';
  assert.equal(shouldUploadSession(false, 'user-1', ended, null), false);
  assert.equal(shouldUploadSession(true, null, ended, null), false);
  assert.equal(shouldUploadSession(true, '', ended, null), false);
});

test('a wiped session stays local and a later one may upload', () => {
  const cutoff = '2026-09-26T09:00:00.000Z';
  assert.equal(shouldUploadSession(true, 'user-1', cutoff, cutoff), false);
  assert.equal(shouldUploadSession(true, 'user-1', '2026-09-26T08:00:00.000Z', cutoff), false);
  assert.equal(shouldUploadSession(true, 'user-1', '2026-09-26T09:00:00.001Z', cutoff), true);
  assert.equal(shouldUploadSession(true, 'user-1', '2026-09-26T08:00:00.000Z', null), true);
});

test('a finished account delete does not flush outboxes or the profile', () => {
  assert.equal(shouldFlushOutboxes('done'), false);
  assert.equal(shouldFlushOutboxes('queued'), true);
  assert.equal(shouldFlushOutboxes('skipped'), true);
});
