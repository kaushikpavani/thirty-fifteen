import assert from 'node:assert/strict';
import test from 'node:test';
import { createPowerCoach, MAX_PER_RIDE, poolFor, POWER_LINES, type PowerNudge } from './powerCoach.ts';

const TARGET = 250;
const REP_MS = 30_000;
const REPS = 13;
const CYCLE = REP_MS + 15_000;

/** Ride `reps` hard reps of 30 s (easy 15 s between), feeding one reading a second; `watts(rep, secInRep)` decides the numbers. */
function ride(watts: (rep: number, sec: number) => number | null, reps = REPS, target = TARGET) {
  const coach = createPowerCoach();
  const out: { rep: number; sec: number; nudge: PowerNudge }[] = [];
  for (let rep = 0; rep < reps; rep++) {
    for (let sec = 0; sec <= REP_MS / 1000; sec++) {
      const nudge = coach.tick({
        rideMs: 600_000 + rep * CYCLE + sec * 1000,
        kind: 'hard',
        repKey: `r${rep}`,
        repElapsedMs: sec * 1000,
        repRemainingMs: REP_MS - sec * 1000,
        watts: watts(rep, sec),
        target,
      });
      if (nudge) out.push({ rep, sec, nudge });
    }
    coach.tick({ rideMs: 600_000 + rep * CYCLE + REP_MS, kind: 'easy', repKey: `e${rep}`, repElapsedMs: 0, repRemainingMs: 15_000, watts: 120, target });
  }
  return out;
}

test('on target the whole ride: the coach never nudges', () => {
  assert.deepEqual(ride(() => 255), []);
  assert.deepEqual(ride(() => 245), [], 'within 6% is on target');
});

test('twenty watts under for a whole rep: one nudge, saying about twenty, after the ramp-up and the encouragement line', () => {
  const nudges = ride((rep) => (rep === 2 ? 230 : 255));
  assert.equal(nudges.length, 1);
  const n = nudges[0]!;
  assert.equal(n.rep, 2);
  assert.equal(n.nudge.type, 'under');
  assert.equal(n.nudge.clip, 'powerUnder20');
  assert.equal(n.nudge.gapW, 20);
  assert.ok(n.sec >= 13 && n.sec <= 26, `at ${n.sec}s`);
});

test('the ramp-up does not count: slow for the first seconds then on target is fine', () => {
  assert.deepEqual(ride((_, sec) => (sec < 7 ? 120 : 255)), []);
});

test('a brief dip is not "consistent"', () => {
  assert.deepEqual(ride((_, sec) => (sec >= 9 && sec <= 11 ? 200 : 255)), []);
});

test('never nags: one per rep, one a minute, and at most eight a ride', () => {
  const nudges = ride(() => 200);
  assert.ok(nudges.length <= MAX_PER_RIDE);
  assert.ok(nudges.length >= 5);
  assert.equal(new Set(nudges.map((n) => n.rep)).size, nudges.length, 'one per rep');
  for (let i = 1; i < nudges.length; i++) {
    const gap = (nudges[i]!.rep * CYCLE + nudges[i]!.sec * 1000) - (nudges[i - 1]!.rep * CYCLE + nudges[i - 1]!.sec * 1000);
    assert.ok(gap >= 60_000, `gap ${gap}`);
  }
});

test('the further under, the more it says: ten, twenty, thirty, then just a push', () => {
  // 150 W target: a 12 W gap is enough to speak (8 W minimum) and rounds to ten.
  assert.equal(ride((r) => (r === 0 ? 138 : 150), REPS, 150)[0]!.nudge.clip, 'powerUnder10');
  assert.equal(ride((r) => (r === 0 ? 230 : 255))[0]!.nudge.clip, 'powerUnder20');
  assert.equal(ride((r) => (r === 0 ? 220 : 255))[0]!.nudge.clip, 'powerUnder30');
  const far = ride((r) => (r === 0 ? 200 : 255))[0]!.nudge;
  assert.equal(far.gapW, 50);
  assert.ok(!/Under/.test(far.clip), 'a long way under is a push, not a number');
  assert.ok(poolFor(9)[0] === 'powerUnder10' && poolFor(31)[0] === 'powerUnder30');
});

test('a gap under 6% of target is on target: no nudge for a 12 W gap at 250 W', () => {
  assert.deepEqual(ride((r) => (r === 0 ? 238 : 255)), []);
});

test('lines rotate so the same words are not repeated back to back', () => {
  const nudges = ride(() => 200);
  const clips = nudges.map((n) => n.nudge.clip);
  for (let i = 1; i < clips.length; i++) assert.notEqual(clips[i], clips[i - 1]);
});

test('no power meter, or a meter that dropped out or sends rubbish: silence', () => {
  assert.deepEqual(ride(() => null), []);
  assert.deepEqual(ride((_, sec) => (sec % 2 ? null : 100)), [], 'too few fresh readings');
  assert.deepEqual(ride(() => Number.NaN), []);
  assert.deepEqual(ride(() => -50), []);
  assert.deepEqual(ride(() => 99_999), []);
  assert.deepEqual(ride(() => 100, REPS, 0), [], 'no target, no nudge');
  assert.deepEqual(ride(() => 100, REPS, Number.NaN), []);
});

test('only HARD reps are coached', () => {
  const coach = createPowerCoach();
  for (const kind of ['warmup', 'accel', 'easy', 'set_rest', 'cooldown']) {
    for (let sec = 0; sec < 40; sec++) {
      assert.equal(coach.tick({ rideMs: sec * 1000, kind, repKey: kind, repElapsedMs: sec * 1000, repRemainingMs: 40_000 - sec * 1000, watts: 50, target: TARGET }), null);
    }
  }
});

test('a rep too short to leave room (15 s) is never coached', () => {
  const coach = createPowerCoach();
  for (let sec = 0; sec <= 15; sec++) {
    assert.equal(coach.tick({ rideMs: sec * 1000, kind: 'hard', repKey: 'a', repElapsedMs: sec * 1000, repRemainingMs: 15_000 - sec * 1000, watts: 100, target: TARGET }), null);
  }
});

test('nothing is said in the last four seconds of a rep, where the next count-in is coming', () => {
  const nudges = ride(() => 200);
  for (const n of nudges) assert.ok(n.sec <= 26);
});

test('after a nudge, getting back on target in the same rep earns one "there it is", and only one', () => {
  const nudges = ride((rep, sec) => (rep === 1 ? (sec < 15 ? 200 : 265) : 255));
  assert.deepEqual(nudges.filter((n) => n.rep === 1).map((n) => n.nudge.type), ['under', 'back']);
  assert.equal(nudges.filter((n) => n.nudge.type === 'back').length, 1);
  const back = nudges.find((n) => n.nudge.type === 'back')!;
  assert.match(back.nudge.clip, /^powerBack/);
  // Staying under after the nudge never produces a "there it is".
  assert.equal(ride((rep) => (rep === 1 ? 200 : 255)).filter((n) => n.nudge.type === 'back').length, 0);
});

test('every clip it can say has words, and the words never claim a number it did not measure', () => {
  for (const gap of [8, 10, 14, 15, 20, 24, 25, 30, 34, 35, 40, 80, 400]) {
    for (const clip of poolFor(gap)) assert.ok(POWER_LINES[clip], clip);
  }
  assert.match(POWER_LINES.powerUnder10!, /About ten/);
  assert.match(POWER_LINES.powerUnder20!, /About twenty/);
  assert.match(POWER_LINES.powerUnder30!, /About thirty/);
});
