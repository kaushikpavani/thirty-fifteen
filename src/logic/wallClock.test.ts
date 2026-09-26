import assert from 'node:assert/strict';
import test from 'node:test';
import { nextPlayhead, runningElapsed } from '../workout/wallClock.ts';

test('running elapsed is wall time minus the paused accumulation', () => {
  assert.equal(runningElapsed(1_000, 0, 0), 1_000);
  assert.equal(runningElapsed(1_800, 800, 5_000), 6_000);
});

test('pause time does not accumulate while the anchor is unused', () => {
  const pausedAt = runningElapsed(10_000, 4_000, 1_500);
  assert.equal(pausedAt, 7_500);
  assert.equal(runningElapsed(99_000, 99_000, pausedAt), pausedAt);
});

test('a backwards or broken clock does not rewind', () => {
  assert.equal(runningElapsed(100, 500, 40), 40);
  assert.equal(runningElapsed(Number.NaN, 500, 40), 40);
  assert.equal(runningElapsed(1_000, Number.NaN, 40), 40);
  assert.equal(runningElapsed(1_000, 0, Number.NaN), 1_000);
});

test('the playhead never moves backwards and never passes the end', () => {
  assert.equal(nextPlayhead(1_000, 900, 5_000), 1_000);
  assert.equal(nextPlayhead(1_000, 2_000, 5_000), 2_000);
  assert.equal(nextPlayhead(1_000, 9_000, 5_000), 5_000);
  assert.equal(nextPlayhead(1_000, Number.NaN, 5_000), 1_000);
  assert.equal(nextPlayhead(Number.NaN, 2_000, 5_000), 2_000);
});
