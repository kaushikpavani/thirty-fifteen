import assert from 'node:assert/strict';
import test from 'node:test';
import { setPlayerRate, type RatePlayer } from './playerRate.ts';

test('uses setPlaybackRate when the player has it, with the best pitch quality', () => {
  const calls: unknown[][] = [];
  const player: RatePlayer = { setPlaybackRate: (...args) => void calls.push(args) };
  assert.equal(setPlayerRate(player, 0.9), true);
  assert.deepEqual(calls, [[0.9, 'high']]);
});

test('an iPhone player whose playbackRate has only a getter does not throw, and the call still works', () => {
  let rate = 1;
  const player = {} as RatePlayer;
  Object.defineProperty(player, 'playbackRate', { get: () => rate });
  player.setPlaybackRate = (r) => void (rate = r);
  assert.doesNotThrow(() => setPlayerRate(player, 1.1));
  assert.equal(player.playbackRate, 1.1);
});

test('a getter-only player with no setter method cannot change speed, but never throws', () => {
  const player = {} as RatePlayer;
  Object.defineProperty(player, 'playbackRate', { get: () => 1 });
  let result: boolean | undefined;
  assert.doesNotThrow(() => {
    result = setPlayerRate(player, 1.2);
  });
  assert.equal(result, false);
});

test('a setter that throws falls back to the property, and a player that throws everywhere is survived', () => {
  const plain: RatePlayer = { setPlaybackRate: () => { throw new Error('native'); } };
  assert.equal(setPlayerRate(plain, 1.05), true);
  assert.equal(plain.playbackRate, 1.05);
  const hostile = new Proxy({}, { set: () => { throw new Error('no'); }, get: () => () => { throw new Error('no'); } }) as RatePlayer;
  assert.doesNotThrow(() => setPlayerRate(hostile, 1.05));
});

test('nonsense speeds are ignored', () => {
  const player: RatePlayer = { playbackRate: 1 };
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(setPlayerRate(player, bad), false);
  assert.equal(player.playbackRate, 1);
});
