import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRideRecord, MIN_SAVE_MS } from '../logic/rideRecord.ts';
import type { WorkoutRecord } from '../types.ts';
import { CHECKPOINT_KEY, createRideCheckpoint } from './rideCheckpoint.ts';
import { createRideStore } from './rideStore.ts';

function memoryKv() {
  const map = new Map<string, string>();
  return {
    map,
    getAllKeys: async () => [...map.keys()],
    multiGet: async (keys: readonly string[]) => keys.map((k) => [k, map.get(k) ?? null] as const),
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => void map.set(key, value),
    removeItem: async (key: string) => void map.delete(key),
    multiRemove: async (keys: readonly string[]) => keys.forEach((k) => map.delete(k)),
  };
}

const workout = {
  segments: [
    { kind: 'warmup', durationMs: 600_000 },
    ...Array.from({ length: 13 }, () => [{ kind: 'hard', durationMs: 30_000, setNumber: 1 }, { kind: 'easy', durationMs: 15_000, setNumber: 1 }]).flat(),
    { kind: 'cooldown', durationMs: 600_000 },
  ],
  totalMs: 600_000 + 13 * 45_000 + 600_000,
  hardWatts: 240,
  easyWatts: 100,
};
const settings = { ftpWatts: 200, sets: 1 };
const START = Date.parse('2026-10-03T18:00:00Z');

/** One sample a second up to `elapsedMs`, as the recorder takes them. */
function samplesUntil(elapsedMs: number) {
  const out = [];
  let acc = 0;
  for (const seg of workout.segments) {
    for (let t = acc; t < Math.min(acc + seg.durationMs, elapsedMs); t += 1000) {
      out.push({ atMs: t, kind: seg.kind as 'hard', watts: seg.kind === 'hard' ? 250 : 110, bpm: seg.kind === 'hard' ? 165 : 140 });
    }
    acc += seg.durationMs;
  }
  return out;
}

function snapshot(elapsedMs: number, id = 'ride-1'): WorkoutRecord {
  return { ...buildRideRecord({ startedAt: START, endedAt: START + elapsedMs, elapsedMs, completed: false, workout, settings, samples: samplesUntil(elapsedMs) }), id };
}

test('battery dies mid-ride: the ride up to the last checkpoint is recovered on the next launch', async () => {
  const kv = memoryKv();
  const checkpoint = createRideCheckpoint(kv);
  const store = createRideStore(kv);
  // Checkpoints every 10 s, then power is lost 14 minutes in (four hard reps done).
  for (let t = 10_000; t <= 840_000; t += 10_000) await checkpoint.save(snapshot(t));
  // --- next launch ---
  const ride = await checkpoint.load();
  assert.ok(ride);
  assert.equal(ride.id, 'ride-1');
  assert.equal(ride.completed, false);
  assert.equal(ride.durationMs, 840_000);
  assert.deepEqual(ride.summary?.repWatts?.slice(0, 4), [250, 250, 250, 250]);
  assert.equal(ride.summary?.avgHardBpm, 165);
  await store.put([ride]);
  await checkpoint.clear();
  assert.equal((await store.read()).rides.length, 1);
  assert.equal(await checkpoint.load(), null);
});

test('only one checkpoint ever exists, however long the ride', async () => {
  const kv = memoryKv();
  const checkpoint = createRideCheckpoint(kv);
  for (let t = 10_000; t <= 300_000; t += 10_000) await checkpoint.save(snapshot(t));
  assert.deepEqual([...kv.map.keys()], [CHECKPOINT_KEY]);
});

test('a checkpoint and the final save are the same ride, so recovery can never duplicate or downgrade it', async () => {
  const kv = memoryKv();
  const checkpoint = createRideCheckpoint(kv);
  const store = createRideStore(kv);
  await checkpoint.save(snapshot(840_000));
  // The ride then finishes normally and is saved, but the app dies before the checkpoint is cleared.
  const finished: WorkoutRecord = { ...buildRideRecord({ startedAt: START, endedAt: START + workout.totalMs, elapsedMs: workout.totalMs, completed: true, workout, settings, samples: samplesUntil(workout.totalMs) }), id: 'ride-1' };
  await store.put([finished]);
  // --- next launch: the stale checkpoint must not replace the finished ride ---
  const stale = await checkpoint.load();
  assert.ok(stale && (await store.has(stale.id)));
  const rides = (await store.read()).rides;
  assert.equal(rides.length, 1);
  assert.equal(rides[0]!.completed, true);
});

test('a damaged or missing checkpoint is ignored, and a failed write never throws', async () => {
  const kv = memoryKv();
  const checkpoint = createRideCheckpoint(kv);
  assert.equal(await checkpoint.load(), null);
  kv.map.set(CHECKPOINT_KEY, '{"half":');
  assert.equal(await checkpoint.load(), null);
  kv.map.set(CHECKPOINT_KEY, JSON.stringify({ id: 'x' }));
  assert.equal(await checkpoint.load(), null);
  const broken = createRideCheckpoint({ ...kv, setItem: async () => Promise.reject(new Error('disk full')), getItem: async () => Promise.reject(new Error('io')) });
  assert.equal(await broken.save(snapshot(60_000)), false);
  assert.equal(await broken.load(), null);
});

test('a ride of a few seconds is a mis-tap; the threshold is shared with the manual save', () => {
  assert.equal(MIN_SAVE_MS, 5000);
  const tiny = buildRideRecord({ startedAt: START, endedAt: START + 3000, elapsedMs: 3000, completed: false, workout, settings, samples: [] });
  assert.equal(tiny.completionPct, 0);
  assert.equal(tiny.summary?.maxBpm, null);
});
