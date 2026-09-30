import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkoutRecord } from '../types.ts';
import { addDownloaded, backupLine, chunk, pendingBackup, planSync, toIso } from './rideSync.ts';

function ride(id: string, endedAt: string): WorkoutRecord {
  return {
    id,
    startedAt: '2026-09-01T17:00:00.000Z',
    endedAt,
    durationMs: 1_800_000,
    plannedDurationMs: 2_760_000,
    ftpWatts: 200,
    hardWatts: 240,
    easyWatts: 100,
    completed: true,
    completionPct: 100,
  };
}

const tenRides = Array.from({ length: 10 }, (_, i) => ride(`r${i}`, `2026-09-${String(10 + i).padStart(2, '0')}T18:00:00.000Z`));

test('10 rides done signed out, then a first sign-in: all 10 are uploaded, none downloaded, none removed', () => {
  const plan = planSync(tenRides, [], null);
  assert.equal(plan.upload.length, 10);
  assert.deepEqual(plan.download, []);
  // Whatever the cloud says, the phone keeps every ride it had.
  assert.equal(addDownloaded(tenRides, []).length, 10);
});

test('after a partial upload, only the rides still missing from the cloud are pending', () => {
  const cloud = new Set(['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
  assert.deepEqual(
    pendingBackup(tenRides, cloud, null).map((r) => r.id),
    ['r7', 'r8', 'r9'],
  );
});

test('a new phone (or a reinstall) downloads the cloud rides it does not have', () => {
  const remote = tenRides.map((r) => ({ id: r.id, endedAt: r.endedAt.replace('.000Z', '+00:00') }));
  const plan = planSync([], remote, null);
  assert.equal(plan.download.length, 10);
  assert.deepEqual(plan.upload, []);
});

test('a phone ride and its cloud copy are never duplicated, and the phone copy wins', () => {
  const phone = { ...tenRides[0]!, ftpWatts: 250 };
  const cloud = { ...tenRides[0]!, ftpWatts: 180 };
  const merged = addDownloaded([phone], [cloud]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.ftpWatts, 250);
});

test('rides at or before the rider’s own delete cutoff are neither uploaded nor downloaded', () => {
  const cutoff = '2026-09-14T18:00:00.000Z';
  // Cloud timestamps come back as "+00:00": compared as instants, not strings.
  const remote = [
    { id: 'old', endedAt: '2026-09-14T18:00:00+00:00' },
    { id: 'new', endedAt: '2026-09-15T18:00:00+00:00' },
  ];
  const plan = planSync([ride('oldLocal', '2026-09-13T18:00:00.000Z')], remote, cutoff);
  assert.deepEqual(plan.download, ['new']);
  assert.deepEqual(plan.upload, []);
});

test('toIso normalizes cloud timestamps and rejects junk', () => {
  assert.equal(toIso('2026-09-29T18:00:00.123456+00:00'), '2026-09-29T18:00:00.123Z');
  assert.equal(toIso('nope'), null);
  assert.equal(toIso(42), null);
});

test('uploads go out in small batches', () => {
  assert.deepEqual(
    chunk(tenRides, 4).map((b) => b.length),
    [4, 4, 2],
  );
});

test('every backup line tells the rider where their rides are', () => {
  assert.match(backupLine({ kind: 'signed-out', total: 10 }), /10 rides saved on this iPhone\. Sign in to back them up/);
  assert.match(backupLine({ kind: 'backed-up', total: 10 }), /All 10 rides backed up/);
  assert.match(backupLine({ kind: 'pending', total: 10, pending: 3, reason: 'offline' }), /3 rides waiting.*safe on this iPhone/);
  assert.match(backupLine({ kind: 'pending', total: 10, pending: 1, reason: 'error' }), /1 ride not backed up yet.*safe on this iPhone/);
});
