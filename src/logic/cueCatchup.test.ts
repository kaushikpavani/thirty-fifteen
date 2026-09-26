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

test('successive flushes fire each cue once', () => {
  const segments = [warmup, easy, hard];
  const firedClock = new Set<string>();
  const firedRocky = new Set<string>();
  const seen = new Map<string, number>();
  let from = 0;
  for (let to = 100; to <= warmup.durationMs + easy.durationMs + hard.durationMs; to += 100) {
    const cues = cuesDue({
      segments,
      fromMs: from,
      toMs: to,
      firedClock,
      firedRocky,
      salt: 2,
    });
    for (const cue of cues) {
      seen.set(cue.key, (seen.get(cue.key) ?? 0) + 1);
      if (cue.type === 'rocky') firedRocky.add(cue.key);
      else firedClock.add(cue.key);
    }
    from = to;
  }
  assert.ok(seen.size > 0);
  for (const [key, count] of seen) assert.equal(count, 1, key);

  const hardLine = cuesDue({
    segments: [hard],
    fromMs: 10_000,
    toMs: 10_100,
    firedClock: new Set(),
    firedRocky: new Set(),
    salt: 2,
  }).find((cue) => cue.type === 'rocky');
  const live = rockyCue({ elapsedMs: 10_100, segments: [hard], fired: new Set(), salt: 2 });
  assert.equal(hardLine?.type === 'rocky' && hardLine.line, live?.line);
  assert.equal(hardLine?.type === 'rocky' && hardLine.clip, live?.clip);
});

test('the same open window is returned again until the caller marks it fired', () => {
  const first = due(0, 100);
  const second = due(100, 200);
  assert.equal(first.some((cue) => cue.key === 'chirp:w'), true);
  assert.equal(second.some((cue) => cue.key === 'chirp:w'), true);
  assert.deepEqual(due(100, 200, [warmup], new Set(['chirp:w'])), []);
});

test('a pause cursor does not replay a window that already ended', () => {
  assert.equal(due(200, 300).some((cue) => cue.key === 'chirp:w'), true);
  assert.equal(due(500, 600).some((cue) => cue.type === 'chirp'), false);
  const fired = new Set(['chirp:w']);
  assert.deepEqual(due(200, 350, [warmup], fired), []);
});

test('the catch-up gap is inclusive at 2s and refuses the next millisecond', () => {
  assert.equal(due(0, 2_000).some((cue) => cue.key === 'chirp:w'), true);
  assert.equal(due(0, 2_001).some((cue) => cue.key === 'chirp:w'), false);

  const inside = cuesDue({
    segments: [hard],
    fromMs: 9_000,
    toMs: 11_001,
    firedClock: new Set(),
    firedRocky: new Set(),
    salt: 0,
  });
  assert.equal(inside.some((cue) => cue.key === 'hard:h'), true);
  const past = cuesDue({
    segments: [hard],
    fromMs: 10_000,
    toMs: 12_001,
    firedClock: new Set(),
    firedRocky: new Set(),
    salt: 0,
  });
  assert.equal(past.some((cue) => cue.type === 'rocky'), false);
});

test('a short custom segment keeps only the latest chirp', () => {
  const tiny = [
    { id: 'a', kind: 'easy', durationMs: 1_000 },
    { id: 'b', kind: 'easy', durationMs: 1_000 },
  ];
  const cues = due(0, 1_500, tiny);
  const chirps = cues.filter((cue) => cue.type === 'chirp');
  assert.deepEqual(chirps.map((cue) => cue.key), ['chirp:b']);
});

test('session salt matches rockyCue and changes the hard line', () => {
  const at = (salt: number) =>
    cuesDue({
      segments: [hard],
      fromMs: 10_500,
      toMs: 10_600,
      firedClock: new Set(),
      firedRocky: new Set(),
      salt,
    }).find((cue) => cue.type === 'rocky');
  const first = at(0);
  const second = at(1);
  const live = rockyCue({ elapsedMs: 10_600, segments: [hard], fired: new Set(), salt: 1 });
  assert.equal(first?.type === 'rocky' && second?.type === 'rocky' && first.clip !== second.clip, true);
  assert.equal(second?.type === 'rocky' && second.line, live?.line);
  assert.equal(second?.type === 'rocky' && second.clip, live?.clip);

  const quiet = cuesDue({
    segments: [easy],
    fromMs: 1_900,
    toMs: 2_000,
    firedClock: new Set(),
    firedRocky: new Set(['welcome']),
    salt: 3,
  });
  assert.equal(quiet.some((cue) => cue.type === 'rocky'), false);
  const spoken = cuesDue({
    segments: [easy],
    fromMs: 1_900,
    toMs: 2_000,
    firedClock: new Set(),
    firedRocky: new Set(['welcome']),
    salt: 0,
  });
  const easyLive = rockyCue({
    elapsedMs: 2_000,
    segments: [easy],
    fired: new Set(['welcome']),
    salt: 0,
  });
  assert.equal(spoken.find((cue) => cue.type === 'rocky')?.key, easyLive?.key);
});
