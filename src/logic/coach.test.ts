import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLOCK_HIT_MS,
  WARN_BEFORE_MS,
  clockHit,
  inSegmentSilence,
  rockyCue,
  ROCKY_EASY,
  ROCKY_FINISH,
  ROCKY_GO,
  ROCKY_HARD,
  ROCKY_ROUND,
  ROCKY_WELCOME,
  EASY_LINES,
  HARD_LINES,
  easySpeaks,
  easyTake,
  finishTake,
  hardTake,
  roundTake,
} from '../audio/rocky.ts';
import {
  BED_VOLUME,
  DUCK_GAIN,
  HARD_OPEN_DUCK_MS,
  bedForKind,
  bedId,
  bedRate,
  boundaryChirp,
  isFirstHard,
  ladderArmed,
  ladderBeep,
  ladderDuckMs,
  ladderKeys,
  ladderSkipped,
  ladderStep,
  ladderTexture,
  roundWon,
  sessionBed,
  varietySalt,
} from '../audio/spirit.ts';
import { HARD_FAMILY, phaseColor } from '../theme/colors.ts';
import { FINISH_TITLES, HOME_TIPS, finishBloom, finishTitle, homeTip } from '../workout/craft.ts';
import { normalizeFeedback } from '../feedback/message.ts';
import { parseCyclingPower, parseIndoorBikeData } from '../ble/parse.ts';
import { buildWorkout } from '../workout/builder.ts';
import { DEFAULT_SETTINGS, derivedWatts } from '../workout/defaults.ts';
import {
  restartTargetMs,
  rockyKeysToRearm,
  segmentStartMs,
  shortenTargetMs,
  skipTargetMs,
} from '../workout/transport.ts';

test('default FTP 125 derives 150 hard and 63 easy', () => {
  assert.equal(DEFAULT_SETTINGS.ftpWatts, 125);
  assert.equal(DEFAULT_SETTINGS.hardPct, 120);
  assert.equal(DEFAULT_SETTINGS.easyPct, 50);
  assert.equal(DEFAULT_SETTINGS.musicEnabled, true);
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

test('clock chirps at the phase and warns at T−3', () => {
  assert.equal(clockHit(0, 30_000), 'chirp');
  assert.equal(clockHit(350, 30_000), 'chirp');
  assert.equal(clockHit(500, 30_000), null);
  assert.equal(clockHit(27_000, 30_000), 'warn');
  assert.equal(clockHit(27_400, 30_000), null);
  assert.equal(clockHit(0, 2_000), 'chirp');
  assert.equal(clockHit(1_700, 2_000), null);
});

test('rocky lines are grit without guilt or comparison', () => {
  assert.equal(ROCKY_WELCOME, "Let's go. Time to get better.");
  assert.equal(ROCKY_HARD, 'Dig in — this is the round that builds you.');
  assert.equal(ROCKY_EASY, "Yes. Breathe fire. You're not done.");
  assert.equal(ROCKY_FINISH, "That's how it's done. You showed up and won the work.");
  const segments = [
    { id: 'h1', kind: 'hard', durationMs: 30_000, repNumber: 1 },
    { id: 'e1', kind: 'easy', durationMs: 15_000, repNumber: 1 },
    { id: 'cd', kind: 'cooldown', durationMs: 600_000 },
  ];
  const lines = [ROCKY_WELCOME, ROCKY_GO, ROCKY_ROUND, ROCKY_FINISH, ...HARD_LINES, ...EASY_LINES];
  assert.equal(rockyCue({ elapsedMs: 11_000, segments, fired: new Set(['welcome']) })?.line, ROCKY_HARD);
  assert.equal(rockyCue({ elapsedMs: 32_000, segments, fired: new Set(['welcome']) })?.line, ROCKY_EASY);
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
  assert.equal(hard?.line, ROCKY_HARD);

  const easy = rockyCue({ elapsedMs: 30_000 + 2000, segments, fired: new Set(['welcome']) });
  assert.equal(easy?.key, 'easy:e1');
  assert.equal(easy?.line, ROCKY_EASY);
  assert.equal(rockyCue({ elapsedMs: 30_000 + 500, segments, fired: none }), null);

  const finishAt = 30_000 + 15_000 + 1500;
  const finish = rockyCue({ elapsedMs: finishAt, segments, fired: new Set(['welcome']) });
  assert.equal(finish?.key, 'finish');
  assert.equal(finish?.line, ROCKY_FINISH);
  assert.equal(rockyCue({ elapsedMs: finishAt, segments, fired: new Set(['welcome', 'finish']) }), null);
});

test('drive bed is for hard and accel, and it ducks harder than it speaks', () => {
  assert.equal(bedForKind('hard'), 'drive');
  assert.equal(bedForKind('accel'), 'drive');
  for (const kind of ['warmup', 'easy', 'set_rest', 'cooldown', 'done']) {
    assert.equal(bedForKind(kind), 'recover');
  }
  assert.ok(BED_VOLUME.drive > BED_VOLUME.recover);
  assert.equal(DUCK_GAIN, 0);
  assert.equal(sessionBed(0), 0);
  assert.equal(sessionBed(1), 1);
  assert.equal(sessionBed(2), 2);
  assert.equal(bedId('hard', 0), 'drive');
  assert.equal(bedId('hard', 1), 'driveB');
  assert.equal(bedId('easy', 1), 'recoverB');
  assert.equal(bedId('hard', 2), 'drive');
  assert.equal(bedRate('hard', 2), 1.04);
  assert.equal(bedRate('easy', 2), 1);
  assert.equal(bedRate('hard', 0), 1);
  assert.ok(BED_VOLUME.driveB > BED_VOLUME.drive);
  assert.ok(BED_VOLUME.recoverB < BED_VOLUME.recover);
});

test('variety rotates by segment and session and never leaves the clock', () => {
  assert.equal(varietySalt(null), 0);
  assert.equal(varietySalt(1_000), varietySalt(1_999));
  assert.notEqual(varietySalt(1_000), varietySalt(2_000));

  assert.equal(hardTake(0, 0).line, HARD_LINES[0]);
  assert.equal(hardTake(1, 0).line, "Hold the line. You're in it.");
  assert.equal(hardTake(2, 0).line, 'This is the work. Stay with it.');
  assert.equal(hardTake(3, 0).line, 'Chin up. Push the watts.');
  for (let i = 0; i < 12; i++) assert.notEqual(hardTake(i, 0).line, hardTake(i + 1, 0).line);
  assert.equal(easyTake(0, 0)?.line, EASY_LINES[0]);
  assert.equal(easyTake(1, 0)?.line, 'Easy. Reload.');
  assert.equal(easyTake(2, 0)?.line, "Good. Next one's yours.");
  assert.equal(easyTake(3, 0), null);
  let silent = 0;
  for (let i = 0; i < 100; i++) if (!easySpeaks(i, 0)) silent += 1;
  assert.equal(silent, 25);

  assert.equal(finishTake().line, ROCKY_FINISH);
  assert.equal(finishTake().clip, 'finish0');
  assert.equal(roundTake().line, 'Round won. Stay sharp.');
  assert.equal(ROCKY_GO, 'Go.');

  assert.equal(ladderSkipped(0), false);
  assert.equal(ladderSkipped(4), false);
  assert.equal(ladderSkipped(5), true);
  assert.equal(ladderSkipped(10), true);
  assert.equal(ladderTexture(0, 0), 'pitch');
  assert.equal(ladderTexture(1, 0), 'volume');
  assert.equal(ladderTexture(2, 0), 'strongThird');
  assert.equal(ladderBeep('three', 0), 'rung3');
  assert.equal(ladderStep(15_000 - 3000, 15_000, 'hard'), 'three');
  assert.equal(ladderStep(15_000 - 1900, 15_000, 'hard'), 'two');
  assert.equal(ladderStep(15_000 - 900, 15_000, 'hard'), 'one');

  assert.equal(phaseColor('hard', 0, 0), '#FF453A');
  assert.equal(phaseColor('hard', 1, 0), HARD_FAMILY[1]);
  assert.notEqual(phaseColor('hard', 0, 0), phaseColor('hard', 1, 0));
  assert.equal(phaseColor('easy', 2, 0), '#64D2FF');
  for (const hex of HARD_FAMILY) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    assert.ok(r > 220 && g < 120 && b < 90);
  }

  assert.equal(homeTip(3_000), null);
  assert.equal(homeTip(0), HOME_TIPS[0]);
  assert.equal(finishTitle(0), 'Done.');
  assert.equal(finishTitle(1), "That's the work.");
  assert.equal(finishTitle(2), 'You showed up.');
  assert.equal(FINISH_TITLES.length, 3);
  assert.equal(finishBloom(0).ms, 320);
  assert.equal(finishBloom(0).pulses, 1);
  assert.equal(finishBloom(1).ms, 480);
  assert.equal(finishBloom(1).warm, true);
  assert.equal(finishBloom(2).pulses, 2);

  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push({ id: `h${i}`, kind: 'hard', durationMs: 30_000, repNumber: i + 1 });
    segments.push({ id: `e${i}`, kind: 'easy', durationMs: 15_000, repNumber: i + 1 });
  }
  segments.push({ id: 'cd', kind: 'cooldown', durationMs: 60_000 });
  const quietEasyAt = 3 * 45_000 + 30_000 + 2_000;
  assert.equal(rockyCue({ elapsedMs: quietEasyAt, segments, fired: new Set(['welcome']), salt: 0 }), null);
  const spoken = rockyCue({ elapsedMs: 30_000 + 2_000, segments, fired: new Set(['welcome']), salt: 0 });
  assert.equal(spoken?.line, EASY_LINES[0]);
  const secondHard = rockyCue({ elapsedMs: 45_000 + 11_000, segments, fired: new Set(['welcome']), salt: 0 });
  assert.equal(secondHard?.line, HARD_LINES[1]);
  assert.equal(secondHard?.clip, 'hard1');
  const finishAt = 4 * 45_000 + 1_500;
  const finish = rockyCue({ elapsedMs: finishAt, segments, fired: new Set(['welcome']), salt: 1 });
  assert.equal(finish?.line, ROCKY_FINISH);
  assert.equal(finish?.clip, 'finish0');
});

test('rising 3-2-1 only into HARD, inside the Rocky silence, with no beep into EASY', () => {
  const built = buildWorkout(DEFAULT_SETTINGS);
  const firstHard = built.segments.findIndex((segment) => segment.kind === 'hard');
  const settle = built.segments[firstHard - 1];
  assert.equal(settle?.kind, 'warmup');
  assert.equal(built.segments[firstHard - 2]?.kind, 'accel');
  assert.ok(settle);
  assert.equal(isFirstHard(firstHard, built.segments), true);
  assert.equal(isFirstHard(firstHard + 2, built.segments), false);
  assert.equal(ladderArmed(settle.durationMs, 'hard'), true);
  assert.equal(ladderStep(settle.durationMs - WARN_BEFORE_MS, settle.durationMs, 'hard'), 'three');
  assert.equal(ladderStep(settle.durationMs - WARN_BEFORE_MS + CLOCK_HIT_MS, settle.durationMs, 'hard'), null);
  assert.equal(ladderStep(settle.durationMs - 2900, settle.durationMs, 'hard'), 'three');
  assert.equal(ladderStep(settle.durationMs - 1900, settle.durationMs, 'hard'), 'two');
  assert.equal(ladderStep(settle.durationMs - 900, settle.durationMs, 'hard'), 'one');
  assert.equal(ladderStep(200, settle.durationMs, 'hard'), null);
  assert.equal(ladderStep(settle.durationMs - 2900, settle.durationMs, 'easy'), null);
  assert.equal(ladderStep(settle.durationMs - 2900, settle.durationMs, 'warmup'), null);
  assert.equal(ladderStep(100, 2_000, 'hard'), null);
  assert.equal(ladderDuckMs('three'), 4000);
  assert.equal(ladderDuckMs('two'), 3000);
  assert.equal(ladderDuckMs('one'), 2000);
  assert.equal(HARD_OPEN_DUCK_MS, 1000);
  assert.equal(clockHit(settle.durationMs - 2900, settle.durationMs), 'warn');
  assert.equal(boundaryChirp('hard'), 'go');
  assert.equal(boundaryChirp('easy'), null);
  assert.equal(boundaryChirp('cooldown'), null);
  assert.equal(boundaryChirp('set_rest'), 'win');
  assert.equal(ROCKY_GO, 'Go.');
  assert.equal(ROCKY_ROUND, 'Round won. Stay sharp.');

  for (const at of [2900, 1900, 900]) {
    const elapsed = settle.durationMs - at;
    assert.equal(inSegmentSilence(elapsed, settle.durationMs), true);
    assert.equal(ladderStep(elapsed, settle.durationMs, 'hard') !== null, at === 2900 || at === 1900 || at === 900);
  }

  const hard = built.segments[firstHard];
  assert.ok(hard);
  assert.equal(ladderStep(hard.durationMs - 2900, hard.durationMs, 'easy'), null);
  const easy = built.segments[firstHard + 1];
  assert.equal(easy?.kind, 'easy');
  assert.equal(ladderStep(easy.durationMs - 2900, easy.durationMs, 'hard'), 'three');
  assert.equal(rockyCue({
    elapsedMs: easy.durationMs - 1500,
    segments: [easy],
    fired: new Set(),
  }), null);

  const rest = built.segments.findIndex((segment) => segment.kind === 'set_rest');
  assert.equal(built.segments[rest - 1]?.kind, 'easy');
  assert.equal(roundWon('easy', 'set_rest'), true);
  assert.equal(roundWon('hard', 'easy'), false);
  assert.equal(roundWon('easy', 'hard'), false);
  assert.equal(roundWon('easy', 'cooldown'), false);
  assert.equal(roundWon(null, 'set_rest'), false);
  assert.equal(ladderStep(built.segments[rest].durationMs - 2900, built.segments[rest].durationMs, 'hard'), 'three');
  assert.deepEqual(ladderKeys('easy-1'), ['ladder:easy-1:three', 'ladder:easy-1:two', 'ladder:easy-1:one']);
});

test('restart, shorten, and skip move the playhead without ending early', () => {
  const built = buildWorkout(DEFAULT_SETTINGS);
  const segments = built.segments;
  const firstHard = segments.findIndex((segment) => segment.kind === 'hard');
  const rest = segments.findIndex((segment) => segment.kind === 'set_rest');
  const cooldown = segments.findIndex((segment) => segment.kind === 'cooldown');
  assert.equal(segments[0]?.kind, 'warmup');
  assert.equal(segments[1]?.kind, 'accel');
  assert.ok(firstHard > 1);
  assert.ok(rest > firstHard);
  assert.equal(segments[rest - 1]?.kind, 'easy');

  assert.equal(restartTargetMs(segments, 0), 0);
  assert.equal(shortenTargetMs(segments, 0), segmentStartMs(segments, 1));
  assert.equal(skipTargetMs(segments, 0), segmentStartMs(segments, firstHard));
  assert.equal(skipTargetMs(segments, 1), segmentStartMs(segments, firstHard));

  assert.equal(restartTargetMs(segments, firstHard), segmentStartMs(segments, firstHard));
  assert.equal(shortenTargetMs(segments, firstHard), segmentStartMs(segments, firstHard + 1));
  assert.equal(skipTargetMs(segments, firstHard), segmentStartMs(segments, firstHard + 1));
  assert.equal(segments[firstHard + 1]?.kind, 'easy');

  const easyBeforeRest = rest - 1;
  assert.equal(shortenTargetMs(segments, easyBeforeRest), segmentStartMs(segments, rest));
  assert.equal(skipTargetMs(segments, easyBeforeRest), segmentStartMs(segments, rest + 1));
  assert.equal(segments[rest + 1]?.kind, 'hard');
  assert.equal(skipTargetMs(segments, rest), segmentStartMs(segments, rest + 1));

  assert.equal(shortenTargetMs(segments, cooldown), built.totalMs);
  assert.equal(skipTargetMs(segments, cooldown), built.totalMs);
  assert.equal(restartTargetMs(segments, cooldown), segmentStartMs(segments, cooldown));

  assert.deepEqual(rockyKeysToRearm(segments[0], 0), [`hard:${segments[0].id}`, `easy:${segments[0].id}`, 'welcome']);
  assert.deepEqual(rockyKeysToRearm(segments[firstHard], segmentStartMs(segments, firstHard)), [
    `hard:${segments[firstHard].id}`,
    `easy:${segments[firstHard].id}`,
  ]);
  assert.ok(rockyKeysToRearm(segments[cooldown], segmentStartMs(segments, cooldown)).includes('finish'));
});

test('feedback keeps free-form text and drops empty notes', () => {
  assert.equal(normalizeFeedback('   '), null);
  assert.equal(normalizeFeedback('you suck'), 'you suck');
  assert.equal(normalizeFeedback('  I want X, Y, and Z.  '), 'I want X, Y, and Z.');
  assert.equal(normalizeFeedback('line one\nline two'), 'line one\nline two');
  assert.equal(normalizeFeedback('a'.repeat(2000))?.length, 2000);
  assert.equal(normalizeFeedback('a'.repeat(2001)), null);
});
