import assert from 'node:assert/strict';
import test from 'node:test';
import { motivationLine } from '../copy/motivation.ts';
import { completionStreak } from '../history/streak.ts';
import { parseCyclingPower, parseIndoorBikeData } from '../ble/parse.ts';
import { buildWorkout } from '../workout/builder.ts';
import { DEFAULT_SETTINGS, derivedWatts } from '../workout/defaults.ts';

test('default FTP 120 derives 144 hard and 60 easy', () => {
  assert.deepEqual(derivedWatts(120, 120, 50), { hard: 144, easy: 60 });
  const built = buildWorkout(DEFAULT_SETTINGS);
  assert.equal(built.hardWatts, 144);
  assert.equal(built.easyWatts, 60);
  const hard = built.segments.filter((segment) => segment.kind === 'hard');
  const easy = built.segments.filter((segment) => segment.kind === 'easy');
  assert.equal(hard.length, 39);
  assert.equal(easy.length, 39);
  assert.equal(hard[0]?.durationMs, 30_000);
  assert.equal(easy[0]?.durationMs, 15_000);
});

test('FTMS indoor bike data reads speed and power', () => {
  const withSpeed = parseIndoorBikeData(Uint8Array.from([0x40, 0x00, 0x8a, 0x0c, 0xba, 0x00]));
  assert.deepEqual(withSpeed, { watts: 186, speedKph: 32.1 });

  const powerOnly = parseIndoorBikeData(Uint8Array.from([0x41, 0x00, 0xba, 0x00]));
  assert.deepEqual(powerOnly, { watts: 186, speedKph: null });

  const averageSpeedSkipped = parseIndoorBikeData(Uint8Array.from([0x43, 0x00, 0x00, 0x00, 0x2c, 0x01]));
  assert.equal(averageSpeedSkipped?.watts, 300);
  assert.equal(averageSpeedSkipped?.speedKph, null);
});

test('cycling power measurement reads instantaneous watts only', () => {
  assert.deepEqual(parseCyclingPower(Uint8Array.from([0x00, 0x00, 0x96, 0x00])), {
    watts: 150,
    speedKph: null,
  });
  assert.equal(parseCyclingPower(Uint8Array.from([0x10, 0x00, 0xc8, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x08]))?.watts, 200);
});

test('streak counts completed days and survives a missed today', () => {
  const now = new Date(2026, 8, 26, 18, 0, 0);
  const day = (date: number, completed: boolean) => ({
    endedAt: new Date(2026, 8, date, 12).toISOString(),
    completed,
  });
  assert.equal(completionStreak([day(26, true), day(25, true), day(24, true)], now), 3);
  assert.equal(completionStreak([day(25, true), day(24, true)], now), 2);
  assert.equal(completionStreak([day(24, true)], now), 0);
  assert.equal(completionStreak([day(26, false), day(25, true)], now), 1);
});

test('motivation uses the streak once it is real', () => {
  const evening = new Date(2026, 8, 26, 19, 0, 0);
  assert.match(motivationLine(evening, 0), /KOM|Lights|session/i);
  assert.equal(motivationLine(evening, 2), 'Two days. The habit is the weapon.');
  assert.match(motivationLine(evening, 4), /4 days straight/);
});
