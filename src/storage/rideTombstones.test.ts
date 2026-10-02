import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkoutRecord } from '../types.ts';
import { createRideStore } from './rideStore.ts';
import { pendingBackup, planSync } from './rideSync.ts';
import { createTombstones, parseTombstones, TOMBSTONE_KEY } from './rideTombstones.ts';

function memoryKv() {
  const map = new Map<string, string>();
  return {
    map,
    getAllKeys: async () => [...map.keys()],
    multiGet: async (keys: readonly string[]) => keys.map((k) => [k, map.get(k) ?? null] as const),
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => void map.set(key, value),
    multiRemove: async (keys: readonly string[]) => keys.forEach((k) => map.delete(k)),
  };
}

const ride = (id: string, endedAt: string): WorkoutRecord => ({
  id,
  startedAt: endedAt,
  endedAt,
  durationMs: 1000,
  plannedDurationMs: 1000,
  ftpWatts: 200,
  hardWatts: 240,
  easyWatts: 100,
  completed: true,
  completionPct: 100,
});

test('deleting one ride removes only that ride from the phone', async () => {
  const kv = memoryKv();
  const store = createRideStore(kv);
  await store.put([ride('a', '2026-10-01T10:00:00Z'), ride('b', '2026-10-01T11:00:00Z'), ride('c', '2026-10-01T12:00:00Z')]);
  await store.remove(['b']);
  assert.deepEqual((await store.read()).rides.map((r) => r.id), ['c', 'a']);
  // Removing a ride that isn't there is harmless.
  await store.remove(['nope']);
  assert.equal((await store.read()).rides.length, 2);
});

test('a deleted ride is never downloaded again, and never re-uploaded', () => {
  const local = [ride('keep', '2026-10-01T10:00:00Z'), ride('zombie', '2026-10-01T09:00:00Z')];
  const remote = [
    { id: 'gone', endedAt: '2026-09-30T10:00:00Z' },
    { id: 'cloudOnly', endedAt: '2026-09-29T10:00:00Z' },
  ];
  const deleted = new Set(['gone', 'zombie']);
  const plan = planSync(local, remote, null, deleted);
  assert.deepEqual(plan.download, ['cloudOnly']);
  assert.deepEqual(plan.upload.map((r) => r.id), ['keep']);
  assert.deepEqual(plan.remove, ['gone']);
  assert.deepEqual(pendingBackup(local, new Set(), null, deleted).map((r) => r.id), ['keep']);
});

test('with no single deletes, sync plans exactly as before', () => {
  const plan = planSync([ride('a', '2026-10-01T10:00:00Z')], [{ id: 'b', endedAt: '2026-09-30T10:00:00Z' }], null);
  assert.deepEqual([plan.upload.map((r) => r.id), plan.download, plan.remove], [['a'], ['b'], []]);
});

test('deletes are remembered across launches', async () => {
  const kv = memoryKv();
  const first = createTombstones(kv);
  await first.add('a');
  await first.add('b');
  await first.add('a');
  assert.deepEqual(JSON.parse(kv.map.get(TOMBSTONE_KEY)!), ['a', 'b']);
  assert.deepEqual([...(await createTombstones(kv).load())], ['a', 'b']);
});

test('if the delete cannot be recorded it fails loudly, so the ride is left alone', async () => {
  const kv = { getItem: async () => null, setItem: async () => Promise.reject(new Error('disk full')) };
  const stones = createTombstones(kv);
  await assert.rejects(() => stones.add('a'));
  assert.equal((await stones.load()).has('a'), false);
});

test('a damaged record reads as empty rather than throwing', () => {
  assert.deepEqual(parseTombstones('{not json'), []);
  assert.deepEqual(parseTombstones('{"a":1}'), []);
  assert.deepEqual(parseTombstones('["a", 3, "", "a", "b"]'), ['a', 'b']);
});
