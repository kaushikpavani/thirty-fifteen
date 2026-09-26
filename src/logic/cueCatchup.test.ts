import assert from 'node:assert/strict';
import test from 'node:test';
import { clockHit, rockyCue } from '../audio/rocky.ts';
import { ladderStep } from '../audio/spirit.ts';
import { cuesDue, type DueCue } from '../workout/cueCatchup.ts';

const warmup = { id: 'w', kind: 'warmup', durationMs: 60_000 };
const easy = { id: 'e', kind: 'easy', durationMs: 15_000, repNumber: 1 };
const hard = { id: 'h', kind: 'hard', durationMs: 30_000, repNumber: 1 };

function due(fromMs: number, toMs: number, segments = [warmup], firedClock = new Set<string>(), firedRocky = new Set<string>()) {
  return cuesDue({ segments, fromMs, toMs, firedClock, firedRocky, salt: 0 });
}

function ladderSteps(cues: DueCue[]) {
  return cues.filter((cue) => cue.type === 'ladder');
}

test('a short tick inside a window matches the live clock', () => {
  const open = due(0, 100);
  assert.equal(open.some((cue) => cue.type === 'chirp' && cue.key === 'chirp:w'), true);
  assert.equal(clockHit(100, warmup.durationMs), 'chirp');

  const welcomeAt = 1_500;
  const welcome = due(welcomeAt - 80, welcomeAt);
  const live = rockyCue({ elapsedMs: welcomeAt, segments: [warmup], fired: new Set(), salt: 0 });
  assert.equal(welcome.find((cue) => cue.type === 'rocky')?.key, live?.key);

  const intoHard = [easy, hard];
  for (let t = 50; t < easy.durationMs; t += 50) {
    const step = ladderStep(t, easy.durationMs, 'hard');
    if (!step) continue;
    const hit = due(t - 50, t, intoHard);
    const rung = ladderSteps(hit);
    assert.equal(rung.length, 1);
    assert.equal(rung[0] && rung[0].type === 'ladder' && rung[0].step, step);
  }
});

test('a throttled tick catches one rung and does not replay it', () => {
  const intoHard = [easy, hard];
  const crossed = due(11_900, 13_400, intoHard);
  const rungs = ladderSteps(crossed);
  assert.equal(rungs.length, 1);
  assert.equal(rungs[0] && rungs[0].type === 'ladder' && rungs[0].step, 'two');

  const fired = new Set(['ladder:e:two']);
  const again = due(13_000, 13_200, intoHard, fired);
  assert.equal(ladderSteps(again).length, 0);
});

test('crossing the boundary plays the chirp and drops expired rungs', () => {
  const intoHard = [easy, hard];
  const crossed = due(11_900, 15_100, intoHard);
  assert.equal(ladderSteps(crossed).length, 0);
  assert.equal(
    crossed.some((cue) => cue.type === 'chirp' && cue.segmentId === 'h'),
    true,
  );
});

test('a long suspension does not dump the backlog', () => {
  assert.deepEqual(due(0, 5_000), []);
  const late = due(0, 90_000, [warmup, easy, hard]);
  assert.deepEqual(late, []);
});

test('opening catch-up speaks welcome once, with the chirp', () => {
  const first = due(0, 1_500);
  assert.equal(first.filter((cue) => cue.type === 'chirp').length, 1);
  assert.equal(first.filter((cue) => cue.type === 'rocky').length, 1);
  assert.equal(first.find((cue) => cue.type === 'rocky')?.key, 'welcome');

  const firedRocky = new Set(['welcome']);
  const firedClock = new Set(['chirp:w']);
  assert.deepEqual(due(1_400, 1_700, [warmup], firedClock, firedRocky), []);
});

test('a skipped ladder approach warns once instead of counting in', () => {
  const segments = [];
  for (let i = 0; i < 5; i++) {
    segments.push({ id: `h${i}`, kind: 'hard', durationMs: 30_000, repNumber: i + 1 });
    segments.push({ id: `e${i}`, kind: 'easy', durationMs: 15_000, repNumber: i + 1 });
  }
  segments.push({ id: 'h5', kind: 'hard', durationMs: 30_000, repNumber: 6 });
  const approach = segments.findIndex((segment) => segment.id === 'e4');
  let start = 0;
  for (let i = 0; i < approach; i++) start += segments[i].durationMs;
  const from = start + 11_900;
  const to = start + 12_100;
  const cues = cuesDue({
    segments,
    fromMs: from,
    toMs: to,
    firedClock: new Set(),
    firedRocky: new Set(),
    salt: 0,
  });
  assert.equal(cues.some((cue) => cue.type === 'warn' && cue.segmentId === 'e4'), true);
  assert.equal(ladderSteps(cues).length, 0);
});
