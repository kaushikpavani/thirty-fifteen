import assert from 'node:assert/strict';
import test from 'node:test';
import { endChoice, setsComplete } from './endRide.ts';

const WARM = 600_000;
const segments = [
  { kind: 'warmup', durationMs: WARM },
  ...[1, 2].flatMap((set) => [
    ...Array.from({ length: 3 }, () => [{ kind: 'hard', durationMs: 30_000 }, { kind: 'easy', durationMs: 15_000 }]).flat(),
    ...(set === 1 ? [{ kind: 'rest', durationMs: 180_000 }] : []),
  ]),
  { kind: 'cooldown', durationMs: 600_000 },
];
const SET1_END = WARM + 3 * 45_000;
const LAST_HARD_END = SET1_END + 180_000 + 2 * 45_000 + 30_000;

test('ending anywhere before the last hard rep is finished asks the rider', () => {
  for (const at of [5_000, 60_000, WARM, WARM + 10_000, SET1_END, SET1_END + 90_000, LAST_HARD_END - 1]) {
    assert.equal(endChoice(segments, at), 'ask', `at ${at}`);
  }
});

test('ending once the sets are done saves without asking: last easy, cool-down, the very end', () => {
  for (const at of [LAST_HARD_END, LAST_HARD_END + 5_000, LAST_HARD_END + 15_000 + 300_000, LAST_HARD_END + 15_000 + 600_000, 9e9]) {
    assert.equal(endChoice(segments, at), 'save', `at ${at}`);
  }
});

test('a mis-tap of a few seconds has nothing to save and nothing to ask', () => {
  assert.equal(endChoice(segments, 0), 'nothing');
  assert.equal(endChoice(segments, 4_999), 'nothing');
});

test('a session with no cool-down still counts the sets as done after the last hard rep', () => {
  const noCool = segments.slice(0, -1);
  assert.equal(setsComplete(noCool, LAST_HARD_END), true);
  assert.equal(setsComplete(noCool, LAST_HARD_END - 1000), false);
});

test('bad clock values never save or ask by accident', () => {
  assert.equal(endChoice(segments, Number.NaN), 'nothing');
  assert.equal(endChoice(segments, -5), 'nothing');
  assert.equal(setsComplete(segments, Number.NaN), false);
  assert.equal(endChoice([{ kind: 'hard', durationMs: Number.NaN }], 6_000), 'ask');
});
