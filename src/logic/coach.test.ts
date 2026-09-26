import assert from 'node:assert/strict';
import test from 'node:test';
import { inSegmentSilence, rockyCue, ROCKY_FINISH, ROCKY_WELCOME } from '../audio/rocky.ts';
import { normalizeFeedback } from '../feedback/message.ts';
import { parseCyclingPower, parseIndoorBikeData } from '../ble/parse.ts';
import { buildWorkout } from '../workout/builder.ts';
import { DEFAULT_SETTINGS, derivedWatts } from '../workout/defaults.ts';

test('default FTP 125 derives 150 hard and 63 easy', () => {
  assert.equal(DEFAULT_SETTINGS.ftpWatts, 125);
  assert.deepEqual(derivedWatts(125, 120, 50), { hard: 150, easy: 63 });
  const built = buildWorkout(DEFAULT_SETTINGS);
  assert.equal(built.hardWatts, 150);
  assert.equal(built.easyWatts, 63);
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

test('rocky lines are grit without guilt or comparison', () => {
  const segments = [
    { id: 'h1', kind: 'hard', durationMs: 30_000, repNumber: 1 },
    { id: 'e1', kind: 'easy', durationMs: 15_000, repNumber: 1 },
    { id: 'cd', kind: 'cooldown', durationMs: 600_000 },
  ];
  const lines = [
    ROCKY_WELCOME,
    ROCKY_FINISH,
    rockyCue({ elapsedMs: 11_000, segments, fired: new Set(['welcome']) })?.line ?? '',
    rockyCue({ elapsedMs: 32_000, segments, fired: new Set(['welcome']) })?.line ?? '',
  ];
  for (const line of lines) {
    assert.ok(line.length > 0);
    assert.doesNotMatch(line, /streak|badge|KOM|come back|excuse|everyone else|don’t blink/i);
  }
});

test('rocky speaks only outside the silence window', () => {
  const segments = [
    { id: 'h1', kind: 'hard', durationMs: 30_000, repNumber: 1 },
    { id: 'e1', kind: 'easy', durationMs: 15_000, repNumber: 1 },
    { id: 'cd', kind: 'cooldown', durationMs: 600_000 },
  ];
  const none = new Set<string>();

  assert.equal(inSegmentSilence(500, 30_000), true);
  assert.equal(inSegmentSilence(28_000, 30_000), true);
  assert.equal(inSegmentSilence(11_000, 30_000), false);
  assert.equal(rockyCue({ elapsedMs: 500, segments, fired: none }), null);
  assert.equal(rockyCue({ elapsedMs: 28_000, segments, fired: none }), null);

  const welcome = rockyCue({ elapsedMs: 1500, segments, fired: none });
  assert.equal(welcome?.key, 'welcome');
  assert.equal(welcome?.line, ROCKY_WELCOME);
  assert.equal(rockyCue({ elapsedMs: 1500, segments, fired: new Set(['welcome']) }), null);

  const hard = rockyCue({ elapsedMs: 11_000, segments, fired: new Set(['welcome']) });
  assert.equal(hard?.key, 'hard:h1');
  assert.ok(hard && hard.line.length > 0);

  const easy = rockyCue({ elapsedMs: 30_000 + 2000, segments, fired: new Set(['welcome']) });
  assert.equal(easy?.key, 'easy:e1');
  assert.equal(rockyCue({ elapsedMs: 30_000 + 500, segments, fired: none }), null);

  const finishAt = 30_000 + 15_000 + 1500;
  const finish = rockyCue({ elapsedMs: finishAt, segments, fired: new Set(['welcome']) });
  assert.equal(finish?.key, 'finish');
  assert.equal(finish?.line, ROCKY_FINISH);
  assert.equal(rockyCue({ elapsedMs: finishAt, segments, fired: new Set(['welcome', 'finish']) }), null);
});

test('feedback keeps free-form text and drops empty notes', () => {
  assert.equal(normalizeFeedback('   '), null);
  assert.equal(normalizeFeedback('you suck'), 'you suck');
  assert.equal(normalizeFeedback('  I want X, Y, and Z.  '), 'I want X, Y, and Z.');
  assert.equal(normalizeFeedback('line one\nline two'), 'line one\nline two');
  assert.equal(normalizeFeedback('a'.repeat(2000))?.length, 2000);
  assert.equal(normalizeFeedback('a'.repeat(2001)), null);
});
