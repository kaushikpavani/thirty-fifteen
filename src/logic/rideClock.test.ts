import assert from 'node:assert/strict';
import test from 'node:test';
import { activeRideMs, addJump } from './rideClock.ts';
import { buildRideRecord } from './rideRecord.ts';

const MIN = 60_000;
const workout = {
  segments: [
    { kind: 'warmup', durationMs: 10 * MIN },
    ...Array.from({ length: 10 }, () => [{ kind: 'hard', durationMs: 30_000, setNumber: 1 }, { kind: 'easy', durationMs: 15_000, setNumber: 1 }]).flat(),
    { kind: 'cooldown', durationMs: 10 * MIN },
  ],
  totalMs: 10 * MIN + 10 * 45_000 + 10 * MIN,
  hardWatts: 240,
  easyWatts: 100,
};
const settings = { ftpWatts: 200, sets: 1 };
const rec = (elapsedMs: number, completed: boolean, activeMs?: number) =>
  buildRideRecord({ startedAt: 0, endedAt: elapsedMs, elapsedMs, completed, workout, settings, samples: [], activeMs });

test('no skipping: the time spent is the playhead', () => {
  assert.equal(activeRideMs(25 * MIN, 0), 25 * MIN);
});

test('skip the whole warm-up after 20 s: ten minutes are not counted as ride time', () => {
  const skew = addJump(0, 20_000, 10 * MIN);
  assert.equal(skew, 10 * MIN - 20_000);
  // Reach the end of the session 7.5 min of intervals and 10 min of cool-down later.
  const playheadAtEnd = workout.totalMs;
  const spent = activeRideMs(playheadAtEnd, skew);
  assert.equal(spent, 20_000 + 10 * 45_000 + 10 * MIN);
  const saved = rec(workout.totalMs, true, spent);
  assert.equal(saved.durationMs, spent);
  assert.equal(saved.summary?.durationMs, spent, 'the Time on the finish screen is honest too');
  assert.equal(saved.completed, true);
  assert.equal(saved.completionPct, 100, 'the session was completed');
});

test('halve the warm-up: only the half that was ridden counts', () => {
  const skew = addJump(0, 2 * MIN, 2 * MIN + 4 * MIN); // 8 min left, jump 4 min
  assert.equal(activeRideMs(workout.totalMs, skew), workout.totalMs - 4 * MIN);
});

test('ending in the cool-down counts only what was ridden, with nothing skipped', () => {
  const at = 10 * MIN + 10 * 45_000 + 3 * MIN;
  const saved = rec(at, false, activeRideMs(at, 0));
  assert.equal(saved.durationMs, at);
});

test('skipping the cool-down: the jump to the end is not ride time', () => {
  const at = 10 * MIN + 10 * 45_000 + 2 * MIN;
  const skew = addJump(0, at, workout.totalMs);
  assert.equal(activeRideMs(workout.totalMs, skew), at);
});

test('restarting a block adds the time it took to ride it again', () => {
  const skew = addJump(0, 5 * MIN, 0); // back to the start of the warm-up after 5 minutes
  assert.equal(activeRideMs(2 * MIN, skew), 7 * MIN);
});

test('several jumps add up, and bad numbers never produce nonsense', () => {
  let skew = addJump(0, 0, 3 * MIN);
  skew = addJump(skew, 3 * MIN + 10_000, 8 * MIN);
  assert.equal(skew, 3 * MIN + (8 * MIN - 3 * MIN - 10_000));
  assert.equal(addJump(skew, Number.NaN, 5), skew);
  assert.equal(addJump(Number.NaN, 0, 5), 5);
  assert.equal(activeRideMs(Number.NaN, 0), 0);
  assert.equal(activeRideMs(1000, 5000), 0, 'never negative');
});

test('a ride saved without the new field (older recovered checkpoint) keeps the playhead time', () => {
  assert.equal(rec(25 * MIN, false).durationMs, 25 * MIN);
});
