import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkoutRecord } from '../types.ts';
import { applyCloudMerge, mergeRecords, safeMergedSessions } from './merge.ts';

function ride(id: string, endedAt: string, ftp = 125): WorkoutRecord {
  return {
    id,
    startedAt: '2026-09-26T08:00:00.000Z',
    endedAt,
    durationMs: 1_000,
    plannedDurationMs: 1_000,
    ftpWatts: ftp,
    hardWatts: 150,
    easyWatts: 63,
    completed: true,
    completionPct: 100,
  };
}

test('merge keeps the copy with the later endedAt and stays newest-first', () => {
  const local = ride('same', '2026-09-26T09:00:00.000Z', 200);
  const remoteOlder = ride('same', '2026-09-26T08:30:00.000Z', 100);
  const remoteOther = ride('other', '2026-09-26T10:00:00.000Z');
  const merged = mergeRecords([local], [remoteOlder, remoteOther]);
  assert.deepEqual(
    merged.map((row) => row.id),
    ['other', 'same'],
  );
  assert.equal(merged[1]?.ftpWatts, 200);
  assert.deepEqual(mergeRecords(merged, merged), merged);
});

test('an older local copy loses to a newer remote copy of the same id', () => {
  const local = ride('same', '2026-09-26T08:00:00.000Z', 110);
  const remote = ride('same', '2026-09-26T09:00:00.000Z', 180);
  const merged = mergeRecords([local], [remote]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.ftpWatts, 180);
});

test('merge never drops rides, however many there are', () => {
  const local = Array.from({ length: 205 }, (_, index) =>
    ride(`id-${index}`, new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()),
  );
  assert.equal(mergeRecords(local, []).length, 205);
});

test('an equal endedAt keeps the phone copy', () => {
  const local = ride('same', '2026-09-26T09:00:00.000Z', 200);
  const remote = ride('same', '2026-09-26T09:00:00.000Z', 100);
  const merged = mergeRecords([local], [remote]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.ftpWatts, 200);
});

test('a history watermark hides the ride that ends on the cutoff', () => {
  const onCutoff = ride('edge', '2026-09-26T09:00:00.000Z');
  const after = ride('later', '2026-09-26T09:00:00.001Z');
  const merged = applyCloudMerge([onCutoff], [onCutoff, after], '2026-09-26T09:00:00.000Z');
  assert.deepEqual(
    merged.map((row) => row.id),
    ['later'],
  );
});

test('a history watermark hides deleted rides and keeps a later one', () => {
  const wiped = ride('old', '2026-09-26T08:00:00.000Z');
  const kept = ride('new', '2026-09-26T12:00:00.000Z');
  const merged = applyCloudMerge([wiped, kept], [wiped], '2026-09-26T09:00:00.000Z');
  assert.deepEqual(
    merged.map((row) => row.id),
    ['new'],
  );
});

test('safeMergedSessions keeps a sync result that only adds to what was showing', () => {
  const before = [ride('a', '2026-09-26T09:00:00.000Z')];
  const merged = [ride('a', '2026-09-26T09:00:00.000Z'), ride('b', '2026-09-26T10:00:00.000Z')];
  assert.deepEqual(safeMergedSessions(before, merged), merged);
});

test('safeMergedSessions falls back to what was already on screen if a sync would shrink it', () => {
  // A first-time sign-in merging a phone's own rides against an empty cloud
  // account should never come back with fewer rides than were already
  // showing — if it somehow does (a bad response, an edge case), keep the
  // rider's own local rides rather than making them look deleted.
  const before = [ride('a', '2026-09-26T09:00:00.000Z'), ride('b', '2026-09-26T10:00:00.000Z')];
  const brokenSync: typeof before = [];
  assert.deepEqual(safeMergedSessions(before, brokenSync), before);
});

test('safeMergedSessions treats an equal count as fine (ids may have legitimately changed which copy won)', () => {
  const before = [ride('a', '2026-09-26T09:00:00.000Z', 100)];
  const merged = [ride('a', '2026-09-26T09:00:00.000Z', 220)];
  assert.deepEqual(safeMergedSessions(before, merged), merged);
});
