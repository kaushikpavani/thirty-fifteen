import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayerPool } from './playerPool.ts';

function harness(max: number, failOn: (source: number) => boolean = () => false) {
  let alive = 0;
  let peak = 0;
  const pool = createPlayerPool({
    max,
    create: (source: number) => {
      if (failOn(source)) throw new Error('too many players');
      alive += 1;
      peak = Math.max(peak, alive);
      return { source, remove: () => void (alive -= 1) };
    },
  });
  return { pool, alive: () => alive, peak: () => peak };
}

test('a whole ride of coach lines never holds more than the cap, where loading all at once needed sixty', () => {
  const { pool, alive, peak } = harness(24);
  // Count-in and Go are pinned at the start of the ride.
  for (let i = 0; i < 12; i++) pool.get(`count${i}`, i, true);
  // Then 26 reps cycling through hard, easy and milestone clips with their takes.
  for (let rep = 0; rep < 200; rep++) pool.get(`clip${rep % 49}`, 100 + (rep % 49));
  assert.ok(peak() <= 25, `peak ${peak()}`);
  assert.equal(alive(), 24);
});

test('the count-in and Go are never released, so they are always ready on the beat', () => {
  const { pool } = harness(6);
  const pinned = [0, 1, 2, 3].map((i) => pool.get(`count${i}`, i, true)!.player);
  for (let i = 0; i < 50; i++) pool.get(`line${i}`, 100 + i);
  [0, 1, 2, 3].forEach((i) => {
    const again = pool.get(`count${i}`, i, true)!;
    assert.equal(again.player, pinned[i]);
    assert.equal(again.fresh, false);
  });
});

test('asking for the same clip again reuses its player; a new clip is marked fresh', () => {
  const { pool } = harness(10);
  const first = pool.get('hard1#0', 7)!;
  assert.equal(first.fresh, true);
  const second = pool.get('hard1#0', 7)!;
  assert.equal(second.fresh, false);
  assert.equal(second.player, first.player);
});

test('one clip failing to load affects only that clip', () => {
  const { pool } = harness(10, (source) => source === 13);
  assert.ok(pool.get('a', 1));
  assert.equal(pool.get('unlucky', 13), null);
  assert.ok(pool.get('b', 2));
  assert.equal(pool.size(), 2);
  assert.equal(pool.lastError(), 'too many players');
});

test('the least recently used clip is the one released', () => {
  const removed: number[] = [];
  const pool = createPlayerPool({ max: 3, create: (source: number) => ({ source, remove: () => void removed.push(source) }) });
  pool.get('a', 1);
  pool.get('b', 2);
  pool.get('c', 3);
  pool.get('a', 1); // a is now the most recent
  pool.get('d', 4);
  assert.deepEqual(removed, [2]);
  pool.clear();
  assert.equal(pool.size(), 0);
});
