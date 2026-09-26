import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PII_PROPERTY_KEYS } from './analytics.ts';
import {
  accountDeleteNote,
  EMPTY_DELETION,
  enqueueCloudJob,
  historyDeleteNote,
  markHistoryDeleted,
  noteSessionDeleteSuccess,
  parseDeletionState,
  withoutJobs,
} from './deletionState.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('a history wipe arms two cloud passes and a later cutoff wins', () => {
  const once = markHistoryDeleted(EMPTY_DELETION, '2026-09-26T08:00:00.000Z');
  assert.equal(once.sessionDeletesLeft, 2);
  assert.equal(once.historyDeletedThrough, '2026-09-26T08:00:00.000Z');
  const later = markHistoryDeleted(noteSessionDeleteSuccess(once), '2026-09-26T09:00:00.000Z');
  assert.equal(later.sessionDeletesLeft, 2);
  assert.equal(later.historyDeletedThrough, '2026-09-26T09:00:00.000Z');
  const healed = noteSessionDeleteSuccess(noteSessionDeleteSuccess(later));
  assert.equal(healed.sessionDeletesLeft, 0);
});

test('cloud jobs are one-per-kind and drop only after success', () => {
  const first = enqueueCloudJob(EMPTY_DELETION, {
    id: 'job-1',
    kind: 'account',
    createdAt: '2026-09-26T08:00:00.000Z',
    deviceId: null,
  });
  const replaced = enqueueCloudJob(first, {
    id: 'job-2',
    kind: 'account',
    createdAt: '2026-09-26T08:05:00.000Z',
    deviceId: null,
  });
  const withDevice = enqueueCloudJob(replaced, {
    id: 'job-3',
    kind: 'device',
    createdAt: '2026-09-26T08:06:00.000Z',
    deviceId: 'device-12345678',
  });
  assert.equal(withDevice.jobs.length, 2);
  assert.equal(withDevice.jobs.find((job) => job.kind === 'account')?.id, 'job-2');
  const left = withoutJobs(withDevice, ['account']);
  assert.deepEqual(
    left.jobs.map((job) => job.kind),
    ['device'],
  );
});

test('corrupt deletion state does not throw the ride away', () => {
  assert.deepEqual(parseDeletionState(null), EMPTY_DELETION);
  assert.deepEqual(parseDeletionState({ jobs: [{ id: 1 }], sessionDeletesLeft: -3 }), EMPTY_DELETION);
});

test('queued deletes do not claim the cloud is already gone', () => {
  assert.match(historyDeleteNote('queued'), /still there/i);
  assert.doesNotMatch(historyDeleteNote('queued'), /and in the cloud/);
  assert.match(historyDeleteNote('done'), /and in the cloud/);
  assert.match(accountDeleteNote('queued'), /still signed in/i);
  assert.match(accountDeleteNote('queued'), /still there/i);
  assert.match(accountDeleteNote('done'), /signed out/i);
  assert.match(accountDeleteNote('unconfigured'), /no account/i);
});

test('account delete SQL removes rider data before the auth user', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20260926160000_deletion.sql'), 'utf8');
  const body = sql.slice(sql.indexOf('function public.delete_my_account'));
  const order = [
    'imported_activities',
    'workout_sessions',
    'app_events',
    'connections',
    'app_feedback',
    'devices',
    'profiles',
    'auth.users',
  ];
  let at = 0;
  for (const name of order) {
    const next = body.indexOf(name, at);
    assert.ok(next > at, name);
    at = next;
  }
  for (const key of PII_PROPERTY_KEYS) {
    assert.match(sql, new RegExp(`'${key}'`));
  }
  assert.match(sql, /security_invoker = true/);
  assert.match(sql, /revoke all on table public.owner_feedback_daily from public, anon, authenticated/);
  assert.match(sql, /Do not use the BioAge project/);
});

test('the readme states the offline, deletion, and free-tool locks', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /Do not use the BioAge project/);
  assert.match(readme, /phone is the source of truth/i);
  assert.match(readme, /This coach is free/);
  assert.match(readme, /Delete workout history/);
  assert.match(readme, /npm test/);
});
