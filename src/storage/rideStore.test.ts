import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkoutRecord } from '../types.ts';
import { createRideStore, LEGACY_KEY, MIGRATED_KEY, RIDE_PREFIX, type KeyValue } from './rideStore.ts';

function memoryKv(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const kv: KeyValue & { data: Map<string, string>; failGet?: boolean } = {
    data,
    async getAllKeys() {
      return [...data.keys()];
    },
    async multiGet(keys) {
      return keys.map((key) => [key, data.get(key) ?? null] as const);
    },
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async multiRemove(keys) {
      for (const key of keys) data.delete(key);
    },
  };
  return kv;
}

function ride(id: string, endedAt: string): WorkoutRecord {
  return {
    id,
    startedAt: '2026-09-29T17:00:00.000Z',
    endedAt,
    durationMs: 1_800_000,
    plannedDurationMs: 2_760_000,
    ftpWatts: 200,
    hardWatts: 240,
    easyWatts: 100,
    completed: false,
    completionPct: 65,
  };
}

test('rides from the old single-blob history are migrated, and the blob is left in place', async () => {
  const legacy = [ride('a', '2026-09-28T10:00:00.000Z'), ride('b', '2026-09-29T10:00:00.000Z')];
  const kv = memoryKv({ [LEGACY_KEY]: JSON.stringify(legacy) });
  const store = createRideStore(kv);
  const first = await store.read();
  assert.equal(first.ok, true);
  assert.deepEqual(first.rides.map((r) => r.id), ['b', 'a']);
  assert.ok(kv.data.has(`${RIDE_PREFIX}a`));
  assert.ok(kv.data.has(LEGACY_KEY), 'legacy blob is kept as a fallback');
  assert.equal(kv.data.get(MIGRATED_KEY), '1');
  // A second launch reads the same rides and does not re-migrate.
  assert.deepEqual((await store.read()).rides.map((r) => r.id), ['b', 'a']);
});

test('an unreadable legacy blob is not marked migrated, so it is retried and never lost', async () => {
  const kv = memoryKv({ [LEGACY_KEY]: '{not json' });
  const store = createRideStore(kv);
  const read = await store.read();
  assert.equal(read.ok, false);
  assert.equal(kv.data.get(MIGRATED_KEY), undefined);
  assert.equal(kv.data.get(LEGACY_KEY), '{not json');
});

test('there is no cap: ride 250 does not push ride 1 off the phone', async () => {
  const kv = memoryKv();
  const store = createRideStore(kv);
  const many = Array.from({ length: 250 }, (_, i) =>
    ride(`r${i}`, new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString()),
  );
  await store.put(many);
  const read = await store.read();
  assert.equal(read.rides.length, 250);
  assert.ok(read.rides.some((r) => r.id === 'r0'));
});

test('put only adds or updates; it never removes rides that are not in the batch', async () => {
  const kv = memoryKv();
  const store = createRideStore(kv);
  await store.put([ride('a', '2026-09-28T10:00:00.000Z'), ride('b', '2026-09-29T10:00:00.000Z')]);
  await store.put([]); // an "empty list" write is a no-op, not a wipe
  await store.put([ride('c', '2026-09-30T10:00:00.000Z')]);
  assert.deepEqual((await store.read()).rides.map((r) => r.id), ['c', 'b', 'a']);
});

test('one corrupted ride is skipped without hiding the others', async () => {
  const kv = memoryKv({
    [MIGRATED_KEY]: '1',
    [`${RIDE_PREFIX}good`]: JSON.stringify(ride('good', '2026-09-29T10:00:00.000Z')),
    [`${RIDE_PREFIX}bad`]: '{broken',
  });
  const read = await createRideStore(kv).read();
  assert.equal(read.ok, false);
  assert.deepEqual(read.rides.map((r) => r.id), ['good']);
  assert.ok(kv.data.has(`${RIDE_PREFIX}bad`), 'reading never deletes, even a broken ride');
});

test('removeAll is the only way rides leave, and it also removes the legacy blob so they do not come back', async () => {
  const kv = memoryKv({ [LEGACY_KEY]: JSON.stringify([ride('old', '2026-09-01T10:00:00.000Z')]) });
  const store = createRideStore(kv);
  await store.put([ride('a', '2026-09-28T10:00:00.000Z')]);
  await store.removeAll();
  assert.deepEqual((await store.read()).rides, []);
  assert.equal(kv.data.has(LEGACY_KEY), false);
});
