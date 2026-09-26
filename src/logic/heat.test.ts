import assert from 'node:assert/strict';
import test from 'node:test';
import { bedRate } from '../audio/spirit.ts';
import {
  DRIVE_BPM,
  HOME_HEAT,
  ROAD_STREAKS,
  ROAD_WASH_OPACITY,
  asphaltSpecks,
  driveBeatMs,
  fieldPaint,
  phasePulse,
} from '../workout/heat.ts';

test('drive glow breathes at the bed tempo, not at a made-up rate', () => {
  assert.equal(DRIVE_BPM, 120);
  assert.equal(driveBeatMs(1), 500);
  assert.equal(driveBeatMs(bedRate('hard', 2)), 481);
  assert.equal(driveBeatMs(1.04), Math.round(60_000 / 120 / 1.04));
  assert.equal(driveBeatMs(0), 500);
  assert.equal(driveBeatMs(Number.NaN), 500);
});

test('paint pulse is HARD music only and never a countdown lock', () => {
  const riding = { music: true, paused: false, reduceMotion: false, rate: 1 };
  assert.deepEqual(phasePulse({ ...riding, kind: 'hard' }), { pulse: true, beatMs: 500 });
  assert.equal(phasePulse({ ...riding, kind: 'accel' }).pulse, true);
  assert.equal(phasePulse({ ...riding, kind: 'easy' }).pulse, false);
  assert.equal(phasePulse({ ...riding, kind: 'set_rest' }).pulse, false);
  assert.equal(phasePulse({ ...riding, kind: 'cooldown' }).pulse, false);
  assert.equal(phasePulse({ ...riding, kind: 'warmup' }).pulse, false);
  assert.equal(phasePulse({ ...riding, kind: 'hard', music: false }).pulse, false);
  assert.equal(phasePulse({ ...riding, kind: 'hard', paused: true }).pulse, false);
  assert.equal(phasePulse({ ...riding, kind: 'hard', reduceMotion: true }).pulse, false);
  const pulsed = phasePulse({ ...riding, kind: 'hard', rate: 1.04 });
  assert.equal(Object.keys(pulsed).join(','), 'pulse,beatMs');
  assert.equal(pulsed.beatMs, 481);
});

test('phase paint fills the field and stays under the white clock', () => {
  const hot = fieldPaint('hot');
  const cool = fieldPaint('cool');
  for (const paint of [hot, cool]) {
    assert.ok(paint.edge > 0.08);
    assert.ok(paint.core > paint.mid && paint.mid > paint.edge);
    assert.ok(paint.core <= 0.7);
  }
  assert.ok(hot.core > cool.core);
  assert.ok(hot.edge > cool.edge);
});

test('bike texture stays a wash under the digits', () => {
  assert.equal(ROAD_WASH_OPACITY, 0.15);
  assert.ok(ROAD_WASH_OPACITY <= 0.15);
  assert.ok(ROAD_STREAKS.length >= 4);
  for (const streak of ROAD_STREAKS) {
    assert.ok(streak.y > 0.2 && streak.y < 0.8);
    assert.ok(streak.thickness > 0 && streak.thickness < 0.05);
    assert.ok(streak.tone > 0 && streak.tone <= 1);
  }
  const specks = asphaltSpecks(64);
  assert.equal(specks.length, 64);
  assert.deepEqual(specks, asphaltSpecks(64));
  for (const speck of specks) {
    assert.ok(speck.x >= 0 && speck.x <= 1);
    assert.ok(speck.y >= 0 && speck.y <= 1);
  }
  assert.equal(asphaltSpecks(0).length, 0);
});

test('home heat is a veil, not a second Start', () => {
  assert.ok(HOME_HEAT >= 0.16 && HOME_HEAT <= 0.28);
});
