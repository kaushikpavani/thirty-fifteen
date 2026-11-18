import assert from 'node:assert/strict';
import test from 'node:test';
import { workoutInterruptionMode } from './focus.ts';

test('a ride that is not in the background mixes on every platform', () => {
  for (const platform of ['ios', 'android', 'web']) {
    assert.equal(workoutInterruptionMode({ platform, background: false, foreignDucks: 0 }), 'mixWithOthers');
    assert.equal(workoutInterruptionMode({ platform, background: false, foreignDucks: 2 }), 'mixWithOthers');
  }
});

test('iOS mixes for the ride and ducks only while a cue is holding other apps down', () => {
  assert.equal(workoutInterruptionMode({ platform: 'ios', background: true, foreignDucks: 0 }), 'mixWithOthers');
  assert.equal(workoutInterruptionMode({ platform: 'ios', background: true, foreignDucks: 1 }), 'duckOthers');
});

test('Android ducks for the whole background ride and never takes exclusive focus', () => {
  assert.equal(workoutInterruptionMode({ platform: 'android', background: true, foreignDucks: 0 }), 'duckOthers');
  assert.equal(workoutInterruptionMode({ platform: 'android', background: true, foreignDucks: 3 }), 'duckOthers');
  const modes = ['ios', 'android', 'web'].map((platform) =>
    workoutInterruptionMode({ platform, background: true, foreignDucks: platform === 'ios' ? 0 : 1 }),
  );
  assert.equal(modes.includes('doNotMix'), false);
});
