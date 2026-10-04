import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRideRecord, MIN_SAVE_MS } from '../logic/rideRecord.ts';
import type { WorkoutRecord } from '../types.ts';
import { CHECKPOINT_KEY, createRideCheckpoint, discardCheckpoint, recoverCheckpoint } from './rideCheckpoint.ts';
import { planSync } from './rideSync.ts';
import { createTombstones } from './rideTombstones.ts';
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

/** The phone as history.ts wires it: one storage, a checkpoint, a ride store and the list of deleted rides. */
function phone(kv = memoryKv()) {
  const checkpoint = createRideCheckpoint(kv);
  const store = createRideStore(kv);
  const tombstones = createTombstones(kv);
  const markDeleted = async (id: string) => {
    try {
      await tombstones.add(id);
    } catch {
      return false;
    }
    await store.remove([id]).catch(() => undefined);
    return true;
  };
  const launch = () =>
    recoverCheckpoint({
      checkpoint,
      isDeleted: async (id) => (await tombstones.load()).has(id),
      isSaved: (id) => store.has(id),
      save: async (ride) => (await store.put([ride]).then(() => true).catch(() => false)),
    });
  return { kv, checkpoint, store, tombstones, markDeleted, launch };
}

test('ended part-way and chose Delete: gone from the phone at once, and stays gone on the next launch', async () => {
  const p = phone();
  for (let t = 10_000; t <= 700_000; t += 10_000) await p.checkpoint.save(snapshot(t));
  assert.equal(await discardCheckpoint(p, 'ride-1'), true);
  assert.equal(await p.checkpoint.load(), null);
  assert.equal((await p.store.read()).rides.length, 0);
  assert.equal(await p.launch(), null);
  assert.equal((await p.store.read()).rides.length, 0);
});

test('a checkpoint write that lands after Delete cannot bring the ride back', async () => {
  const p = phone();
  await p.checkpoint.save(snapshot(600_000));
  await discardCheckpoint(p, 'ride-1');
  // The last periodic write was already on its way when the rider tapped Delete.
  await p.checkpoint.save(snapshot(610_000));
  assert.equal(await p.launch(), null);
  assert.equal(await p.checkpoint.load(), null, 'the late checkpoint is cleaned up');
  assert.equal((await p.store.read()).rides.length, 0);
  // And again, however many times the app is opened.
  assert.equal(await p.launch(), null);
});

test('a deleted ride is never uploaded, and a copy that reached the account is removed from it', async () => {
  const p = phone();
  await p.checkpoint.save(snapshot(600_000));
  await discardCheckpoint(p, 'ride-1');
  const deleted = await p.tombstones.load();
  // Even if a copy were still on the phone it would not go up.
  assert.deepEqual(planSync([snapshot(600_000)], [], null, deleted), { upload: [], download: [], remove: [] });
  // A copy already in the account (another phone, an earlier save) is removed and never downloaded.
  const plan = planSync([], [{ id: 'ride-1', endedAt: new Date(START + 600_000).toISOString() }], null, deleted);
  assert.deepEqual(plan, { upload: [], download: [], remove: ['ride-1'] });
});

test('Delete only ever removes that ride: earlier rides and the next ride are untouched', async () => {
  const p = phone();
  await p.store.put([snapshot(900_000, 'older')]);
  await p.checkpoint.save(snapshot(600_000, 'ride-1'));
  await discardCheckpoint(p, 'ride-1');
  assert.deepEqual((await p.store.read()).rides.map((r) => r.id), ['older']);
  // The next ride is interrupted by a dead battery: it is recovered as usual.
  await p.checkpoint.save(snapshot(300_000, 'ride-2'));
  assert.equal((await p.launch())?.id, 'ride-2');
  assert.deepEqual((await p.store.read()).rides.map((r) => r.id).sort(), ['older', 'ride-2']);
});

test('battery dies while the Save-or-Delete question is on screen: the ride is kept', async () => {
  const p = phone();
  for (let t = 10_000; t <= 700_000; t += 10_000) await p.checkpoint.save(snapshot(t));
  // No answer was given. Keeping is the safe default.
  const ride = await p.launch();
  assert.equal(ride?.id, 'ride-1');
  assert.equal(ride?.durationMs, 700_000);
  assert.equal((await p.store.read()).rides.length, 1);
});

test('storage refuses the delete record: the in-progress copy is still removed and nothing comes back', async () => {
  const kv = memoryKv();
  const good = phone(kv);
  await good.checkpoint.save(snapshot(600_000));
  const failing = phone({ ...kv, setItem: async () => Promise.reject(new Error('disk full')) });
  assert.equal(await discardCheckpoint(failing, 'ride-1'), false);
  assert.equal(await good.checkpoint.load(), null);
  assert.equal(await good.launch(), null);
});

test('tapping Delete twice, or deleting a ride with no checkpoint yet, is harmless', async () => {
  const p = phone();
  assert.equal(await discardCheckpoint(p, 'ride-1'), true);
  assert.equal(await discardCheckpoint(p, 'ride-1'), true);
  assert.deepEqual([...(await p.tombstones.load())], ['ride-1']);
  assert.equal(await p.launch(), null);
});

test('recovery after a normal finish never replaces the finished ride (real recovery path)', async () => {
  const p = phone();
  await p.checkpoint.save(snapshot(840_000));
  const finished: WorkoutRecord = { ...buildRideRecord({ startedAt: START, endedAt: START + workout.totalMs, elapsedMs: workout.totalMs, completed: true, workout, settings, samples: samplesUntil(workout.totalMs) }), id: 'ride-1' };
  await p.store.put([finished]);
  assert.equal(await p.launch(), null);
  assert.equal((await p.store.read()).rides[0]!.completed, true);
  assert.equal(await p.checkpoint.load(), null);
});
