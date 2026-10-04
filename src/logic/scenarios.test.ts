/**
 * Scenario simulations: whole rides and whole lifetimes of data, run through
 * the real logic with awkward inputs. These don't check one function; they
 * check that the rules the app promises hold no matter the settings, the
 * sensors, the interruptions or the order things happen in.
 *
 * Randomness is seeded, so a failure is always reproducible.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { COACH_LINES } from '../audio/coachLines.ts';
import { resolveClip } from '../audio/voices.ts';
import { addDownloaded, pendingBackup, planSync } from '../storage/rideSync.ts';
import { createRideStore } from '../storage/rideStore.ts';
import type { WorkoutRecord, WorkoutSettings } from '../types.ts';
import { buildWorkout } from '../workout/builder.ts';
import { cuesDue, takeCue, type DueCue } from '../workout/cueCatchup.ts';
import { DEFAULT_SETTINGS } from '../workout/defaults.ts';
import { rideCardSvg } from './rideCard.ts';
import { buildRideRecord } from './rideRecord.ts';
import { parseStoredSummary, type RideSample } from './rideSummary.ts';
import { zoneCopy, zoneResult } from './zone.ts';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pick = <T,>(rand: () => number, items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;

/** Settings from every corner of what the Settings screen allows, plus seeded random ones in between. */
function settingsMatrix(): WorkoutSettings[] {
  const corners: Partial<WorkoutSettings>[] = [
    {},
    { sets: 1, reps: 4, workSec: 15, recoverSec: 10, warmupMin: 5, betweenSetRestMin: 1, cooldownMin: 3 },
    { sets: 6, reps: 20, workSec: 60, recoverSec: 30, warmupMin: 30, betweenSetRestMin: 10, cooldownMin: 20 },
    { sets: 1, reps: 20, workSec: 15, recoverSec: 30 },
    { sets: 6, reps: 4, workSec: 60, recoverSec: 10 },
    { sets: 3, reps: 13, warmupMin: 5, cooldownMin: 20 },
  ];
  const rand = rng(3015);
  for (let i = 0; i < 10; i++) {
    corners.push({
      sets: 1 + Math.floor(rand() * 6),
      reps: 4 + Math.floor(rand() * 17),
      workSec: pick(rand, [15, 20, 30, 45, 60]),
      recoverSec: pick(rand, [10, 15, 20, 30]),
      warmupMin: 5 + Math.floor(rand() * 26),
      betweenSetRestMin: 1 + Math.floor(rand() * 10),
      cooldownMin: 3 + Math.floor(rand() * 18),
    });
  }
  return corners.map((c) => ({ ...DEFAULT_SETTINGS, ...c }));
}

/** Drive a whole ride through the cue clock the way the engine does, with the given tick sizes. */
function rideCues(settings: WorkoutSettings, nextStep: () => number) {
  const workout = buildWorkout(settings);
  const firedClock = new Set<string>();
  const firedRocky = new Set<string>();
  const played: DueCue[] = [];
  let maxPerFlush = 0;
  let last = 0;
  while (last < workout.totalMs) {
    const to = Math.min(workout.totalMs, last + nextStep());
    const due = cuesDue({ segments: workout.segments, fromMs: last, toMs: to, firedClock, firedRocky, salt: 3, fullLadder: true });
    maxPerFlush = Math.max(maxPerFlush, due.length);
    for (const cue of due) {
      assert.ok(takeCue(firedClock, firedRocky, cue), `cue ${cue.key} was offered twice`);
      played.push(cue);
    }
    last = to;
  }
  return { workout, played, maxPerFlush };
}

const label = (s: WorkoutSettings) => `${s.sets}x${s.reps} ${s.workSec}/${s.recoverSec} wu${s.warmupMin} rest${s.betweenSetRestMin} cd${s.cooldownMin}`;

test('every allowed combination of settings builds a sane session', () => {
  for (const settings of settingsMatrix()) {
    const w = buildWorkout(settings);
    const sum = w.segments.reduce((total, seg) => total + seg.durationMs, 0);
    assert.equal(sum, w.totalMs, label(settings));
    assert.ok(w.segments.every((seg) => Number.isFinite(seg.durationMs) && seg.durationMs > 0), label(settings));
    assert.equal(w.segments.filter((seg) => seg.kind === 'hard').length, settings.sets * settings.reps, label(settings));
    assert.equal(new Set(w.segments.map((seg) => seg.id)).size, w.segments.length, 'segment ids are unique');
    assert.equal(w.segments[0]!.kind, 'warmup');
    assert.equal(w.segments[w.segments.length - 1]!.kind, 'cooldown');
  }
});

test('a full ride, start to finish, for every settings combination: every cue on time, none twice', () => {
  for (const settings of settingsMatrix()) {
    const { workout, played } = rideCues(settings, () => 250);
    const name = label(settings);
    const keys = played.map((cue) => cue.key);
    assert.equal(new Set(keys).size, keys.length, `${name}: a cue repeated`);

    // Every part of the ride announces itself with exactly one chirp.
    const chirps = played.filter((cue) => cue.type === 'chirp');
    assert.equal(chirps.length, workout.segments.length, `${name}: one chirp per segment`);

    // Every hard rep gets its full spoken count-in: three, two, one.
    const ladders = played.filter((cue) => cue.type === 'ladder' && cue.nextKind === 'hard');
    assert.equal(ladders.length, 3 * settings.sets * settings.reps, `${name}: count-in before every hard rep`);

    // The opening line, the one-minute warning and the cool-down line each happen exactly once.
    assert.equal(keys.filter((key) => key === 'welcome').length, 1, `${name}: welcome`);
    assert.equal(keys.filter((key) => key === 'warmup:left1').length, 1, `${name}: one minute of warm-up left`);
    assert.equal(keys.filter((key) => key === 'finish').length, 1, `${name}: cool-down line`);

    // Every spoken line has a recording for these exact settings.
    for (const cue of played) {
      if (cue.type !== 'rocky' && cue.type !== 'remaining') continue;
      const take = resolveClip({ key: cue.key, clip: cue.clip, line: 'line' in cue ? cue.line : '' }, settings);
      assert.ok(take && take.clip && COACH_LINES.en![take.clip], `${name}: no recording for ${cue.key} (${cue.clip})`);
    }
  }
});

test('phone locked, app in the background, clock jumping: no cue is ever doubled and nothing piles up', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const rand = rng(seed);
    const settings = pick(rand, settingsMatrix());
    // Mostly normal ticks, with stalls from one second to five minutes thrown in.
    const step = () => (rand() < 0.02 ? 1000 + Math.floor(rand() * 300_000) : 100 + Math.floor(rand() * 200));
    const { played, maxPerFlush } = rideCues(settings, step);
    const keys = played.map((cue) => cue.key);
    assert.equal(new Set(keys).size, keys.length, `seed ${seed}: a cue repeated after a stall`);
    // After any gap the rider hears at most one of each kind, never a backlog.
    assert.ok(maxPerFlush <= 5, `seed ${seed}: ${maxPerFlush} cues fired at once`);
  }
});

// ——— Sensors ———

const settings = DEFAULT_SETTINGS;
const workout = buildWorkout(settings);

function recordWith(sample: (atMs: number, kind: string) => { watts: number | null; bpm: number | null }, elapsedMs = workout.totalMs) {
  const samples: RideSample[] = [];
  let acc = 0;
  for (const seg of workout.segments) {
    for (let t = acc; t < Math.min(acc + seg.durationMs, elapsedMs); t += 1000) samples.push({ atMs: t, kind: seg.kind, ...sample(t, seg.kind) });
    acc += seg.durationMs;
  }
  return buildRideRecord({ startedAt: 1_790_000_000_000, endedAt: 1_790_000_000_000 + elapsedMs, elapsedMs, completed: elapsedMs >= workout.totalMs, workout, settings, samples });
}

const good = (kind: string) => ({ watts: kind === 'hard' ? 250 : 110, bpm: kind === 'hard' ? 168 : 140 });

const sensorCases: Record<string, (atMs: number, kind: string) => { watts: number | null; bpm: number | null }> = {
  'no sensors at all': () => ({ watts: null, bpm: null }),
  'power meter only': (_t, kind) => ({ watts: good(kind).watts, bpm: null }),
  'heart rate only': (_t, kind) => ({ watts: null, bpm: good(kind).bpm }),
  'both sensors': (_t, kind) => good(kind),
  'heart-rate monitor drops out for ten minutes mid-ride': (t, kind) => ({ watts: good(kind).watts, bpm: t > 900_000 && t < 1_500_000 ? null : good(kind).bpm }),
  'power meter drops out for the second set': (t, kind) => ({ watts: t > 1_500_000 ? null : good(kind).watts, bpm: good(kind).bpm }),
  'both connect late, halfway through': (t, kind) => (t < workout.totalMs / 2 ? { watts: null, bpm: null } : good(kind)),
  'sensors send rubbish': (t) => ({ watts: [NaN, -50, Infinity, 0, 9999][t % 5]!, bpm: [NaN, 0, -1, 300, Infinity][t % 5]! }),
  'power meter reads zero while coasting': (_t, kind) => ({ watts: kind === 'hard' ? 250 : 0, bpm: good(kind).bpm }),
};

test('every sensor situation produces a clean ride record, a verdict and a shareable card', () => {
  for (const [name, sample] of Object.entries(sensorCases)) {
    for (const elapsed of [workout.totalMs, Math.round(workout.totalMs * 0.37), 6000]) {
      const record = recordWith(sample, elapsed);
      const summary = record.summary!;
      const text = JSON.stringify(record);
      assert.doesNotMatch(text, /NaN|Infinity|undefined/, `${name}: bad number in the saved ride`);
      // What is saved must survive being stored and read back unchanged.
      const back = parseStoredSummary(JSON.parse(JSON.stringify(summary)));
      assert.ok(back, `${name}: saved summary could not be read back`);
      assert.equal(back.durationMs, summary.durationMs);
      for (const value of [summary.avgWatts, summary.avgBpm, summary.maxBpm, summary.avgHardWatts, summary.workKj]) {
        assert.ok(value == null || (Number.isFinite(value) && value >= 0), `${name}: ${value}`);
      }
      const verdict = zoneResult({ summary, observedMaxBpm: null, ageYears: 46, hardTarget: record.hardWatts });
      const copy = zoneCopy(verdict);
      assert.ok(copy.headline.length > 0 && !/NaN|undefined/.test(copy.headline + copy.body), `${name}: verdict text`);
      if (verdict.kind === 'hr') assert.ok(verdict.ms >= 0 && verdict.ms <= summary.durationMs + 1000, `${name}: time near VO2max within the ride`);
      const card = rideCardSvg({ endedAt: record.endedAt, ftpWatts: record.ftpWatts, completed: record.completed, hardTarget: record.hardWatts, summary });
      assert.doesNotMatch(card.svg, /NaN|undefined|Infinity/, `${name}: share card`);
    }
  }
});

test('a ride with no heart-rate monitor never claims time near VO2max', () => {
  for (const name of ['no sensors at all', 'power meter only']) {
    const summary = recordWith(sensorCases[name]!).summary!;
    assert.notEqual(zoneResult({ summary, observedMaxBpm: 180, ageYears: 46, hardTarget: 144 }).kind, 'hr', name);
    assert.equal(summary.hrSecs, undefined, name);
  }
});

// ——— Storage ———

function flakyKv(rand: () => number, failRate: number) {
  const map = new Map<string, string>();
  const fail = () => rand() < failRate;
  return {
    map,
    getAllKeys: async () => (fail() ? Promise.reject(new Error('io')) : [...map.keys()]),
    multiGet: async (keys: readonly string[]) => (fail() ? Promise.reject(new Error('io')) : keys.map((k) => [k, map.get(k) ?? null] as const)),
    getItem: async (key: string) => (fail() ? Promise.reject(new Error('io')) : (map.get(key) ?? null)),
    setItem: async (key: string, value: string) => (fail() ? Promise.reject(new Error('disk full')) : void map.set(key, value)),
    multiRemove: async (keys: readonly string[]) => (fail() ? Promise.reject(new Error('io')) : keys.forEach((k) => map.delete(k))),
  };
}

const ride = (id: string, day: number): WorkoutRecord => ({
  id,
  startedAt: new Date(Date.UTC(2026, 8, day, 18)).toISOString(),
  endedAt: new Date(Date.UTC(2026, 8, day, 19)).toISOString(),
  durationMs: 2_700_000,
  plannedDurationMs: 2_700_000,
  ftpWatts: 200,
  hardWatts: 240,
  easyWatts: 100,
  completed: true,
  completionPct: 100,
});

test('storage that fails one time in five: a ride that was saved is never lost, and failures never corrupt others', async () => {
  for (const seed of [11, 12, 13]) {
    const rand = rng(seed);
    const kv = flakyKv(rand, 0.2);
    const store = createRideStore(kv);
    const saved = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const id = `r${i}`;
      const op = rand();
      if (op < 0.7) {
        // Save a ride, retrying the way the app does. Only count it once the write is confirmed.
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            await store.put([ride(id, 1 + (i % 28))]);
            saved.add(id);
            break;
          } catch {
            // try again
          }
        }
      } else {
        // Reads may fail; they must never write or remove anything.
        await store.read().catch(() => null);
      }
    }
    // Read back on healthy storage: everything confirmed saved is there.
    const healthy = createRideStore({ ...kv, getAllKeys: async () => [...kv.map.keys()], multiGet: async (keys) => keys.map((k) => [k, kv.map.get(k) ?? null] as const), getItem: async (k) => kv.map.get(k) ?? null });
    const ids = new Set((await healthy.read()).rides.map((r) => r.id));
    for (const id of saved) assert.ok(ids.has(id), `seed ${seed}: ${id} was saved and then lost`);
  }
});

test('updating the app with ten rides from the old storage format keeps all ten, in order', async () => {
  const map = new Map<string, string>();
  const old = Array.from({ length: 10 }, (_, i) => ride(`legacy-${i}`, 1 + i));
  map.set('@thirtyfifteen/history/v1', JSON.stringify(old));
  const kv = {
    getAllKeys: async () => [...map.keys()],
    multiGet: async (keys: readonly string[]) => keys.map((k) => [k, map.get(k) ?? null] as const),
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => void map.set(key, value),
    multiRemove: async (keys: readonly string[]) => keys.forEach((k) => map.delete(k)),
  };
  const store = createRideStore(kv);
  // First launch of the new version, then a second launch, then a new ride.
  assert.equal((await store.read()).rides.length, 10);
  assert.equal((await store.read()).rides.length, 10);
  await store.put([ride('new', 30)]);
  const rides = (await store.read()).rides;
  assert.equal(rides.length, 11);
  assert.equal(rides[0]!.id, 'new');
  assert.deepEqual(rides.slice(1).map((r) => r.id), old.map((r) => r.id).reverse());
});

// ——— Two phones, one account ———

type Phone = { rides: WorkoutRecord[]; deleted: Set<string> };

/** One backup pass for a phone against the shared cloud, following the app's own plan. */
function sync(phone: Phone, cloud: Map<string, WorkoutRecord>) {
  const remote = [...cloud.values()].map((r) => ({ id: r.id, endedAt: r.endedAt }));
  const plan = planSync(phone.rides, remote, null, phone.deleted);
  for (const r of plan.upload) if (!cloud.has(r.id)) cloud.set(r.id, r); // insert only; never replaces a cloud ride
  for (const id of plan.remove) cloud.delete(id);
  phone.rides = addDownloaded(phone.rides, plan.download.map((id) => cloud.get(id)!).filter(Boolean));
}

test('two phones on one account: both end up with every ride and neither overwrites the other', () => {
  const cloud = new Map<string, WorkoutRecord>();
  const a: Phone = { rides: [ride('a1', 1), ride('a2', 3), ride('a3', 5)], deleted: new Set() };
  const b: Phone = { rides: [ride('b1', 2), ride('b2', 4)], deleted: new Set() };
  // Any order, repeated: syncing is safe to run as often as it likes.
  for (const phone of [a, b, a, b, b, a]) sync(phone, cloud);
  const all = ['a1', 'a2', 'a3', 'b1', 'b2'];
  assert.deepEqual([...cloud.keys()].sort(), all);
  assert.deepEqual(a.rides.map((r) => r.id).sort(), all);
  assert.deepEqual(b.rides.map((r) => r.id).sort(), all);
  assert.equal(pendingBackup(a.rides, new Set(cloud.keys()), null).length, 0);
  // Both riding on the same day produces two rides, not one overwritten.
  a.rides.unshift(ride('a-same-day', 9));
  b.rides.unshift(ride('b-same-day', 9));
  for (const phone of [a, b, a]) sync(phone, cloud);
  assert.ok(a.rides.some((r) => r.id === 'b-same-day') && b.rides.some((r) => r.id === 'a-same-day'));
});

test('a ride deleted on one phone stays deleted on that phone, whatever the other phone does', () => {
  const cloud = new Map<string, WorkoutRecord>();
  const a: Phone = { rides: [ride('x', 1), ride('y', 2)], deleted: new Set() };
  const b: Phone = { rides: [], deleted: new Set() };
  sync(a, cloud);
  sync(b, cloud);
  // A deletes x.
  a.deleted.add('x');
  a.rides = a.rides.filter((r) => r.id !== 'x');
  for (const phone of [a, b, a, b, a]) sync(phone, cloud);
  assert.equal(a.rides.some((r) => r.id === 'x'), false, 'the deleted ride came back on the phone that deleted it');
  assert.ok(a.rides.some((r) => r.id === 'y'));
});

// ——— Deleting the app and reinstalling ———

test('delete the app, reinstall, sign in with the same account: every backed-up ride comes back, complete', async () => {
  const { recordFromRow, workoutSessionWrite } = await import('../storage/cloudRow.ts');
  // Twelve real rides with full stats, recorded over a month and backed up.
  const original: WorkoutRecord[] = Array.from({ length: 12 }, (_, i) => ({
    ...recordWith((_t, kind) => good(kind), i % 4 === 3 ? Math.round(workout.totalMs * 0.6) : workout.totalMs),
    id: `ride-${i}`,
    startedAt: new Date(Date.UTC(2026, 8, 1 + i * 2, 18)).toISOString(),
    endedAt: new Date(Date.UTC(2026, 8, 1 + i * 2, 19)).toISOString(),
  }));
  // The cloud stores rows as JSON, with timestamps in Postgres' own format.
  const cloudRows = original.map((r) => {
    const row = JSON.parse(JSON.stringify(workoutSessionWrite(r, 'user-1', 'old-install'))) as Record<string, unknown>;
    row.started_at = String(row.started_at).replace('Z', '+00:00');
    row.ended_at = String(row.ended_at).replace('Z', '+00:00');
    return row;
  });

  // --- the app is deleted: the phone has nothing. Reinstall and sign in. ---
  const remote = cloudRows.map((row) => ({ id: row.id as string, endedAt: new Date(row.ended_at as string).toISOString() }));
  const plan = planSync([], remote, null, new Set());
  assert.equal(plan.download.length, 12);
  assert.equal(plan.upload.length, 0);
  assert.equal(plan.remove.length, 0);

  const restored = plan.download.map((id) => recordFromRow(cloudRows.find((row) => row.id === id)!));
  assert.ok(restored.every(Boolean), 'a cloud row could not be turned back into a ride');
  const phone = addDownloaded([], restored as WorkoutRecord[]);
  assert.equal(phone.length, 12);

  // Nothing about a ride is lost on the way to the cloud and back.
  for (const before of original) {
    const after = phone.find((r) => r.id === before.id)!;
    assert.deepEqual(after, before, `${before.id} changed on the round trip`);
    assert.ok(after.summary?.hrSecs && after.summary.repWatts?.length, 'per-rep and heart-rate detail survived');
  }
  // Newest first, as Past rides shows them, and a second sync has nothing left to do.
  assert.deepEqual(phone.map((r) => r.id), original.map((r) => r.id).reverse());
  const again = planSync(phone, remote, null, new Set());
  assert.deepEqual([again.download.length, again.upload.length], [0, 0]);
});

test('a ride never backed up cannot be restored, and the app says how many are still waiting', () => {
  // Signed out (or offline) for these rides: they exist only on the phone.
  const local = [ride('only-here-1', 5), ride('only-here-2', 6), ride('backed-up', 1)];
  const waiting = pendingBackup(local, new Set(['backed-up']), null);
  assert.deepEqual(waiting.map((r) => r.id), ['only-here-1', 'only-here-2']);
});

test('a damaged cloud row is skipped without stopping the others', async () => {
  const { recordFromRow, workoutSessionWrite } = await import('../storage/cloudRow.ts');
  const goodRow = JSON.parse(JSON.stringify(workoutSessionWrite(ride('ok', 3), 'user-1', null))) as Record<string, unknown>;
  const rows: Record<string, unknown>[] = [
    goodRow,
    { ...goodRow, id: 'no-dates', started_at: null, ended_at: 'not a date' },
    { ...goodRow, id: 'bad-numbers', duration_ms: 'long' },
    { ...goodRow, id: 'junk-summary', summary: { setsDone: 'two' } },
    {},
  ];
  const out = rows.map(recordFromRow);
  assert.deepEqual(out.map((r) => r?.id ?? null), ['ok', null, null, 'junk-summary', null]);
  // A ride whose stats are unreadable still comes back, just without the stats.
  assert.equal(out[3]!.summary, undefined);
});
