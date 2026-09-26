import assert from 'node:assert/strict';
import test from 'node:test';
import { takeCue, type DueCue } from '../workout/cueCatchup.ts';
import {
  IDLE_PRESENCE,
  isAppInFront,
  reduceAppPresence,
  type PresenceEffect,
  type PresenceState,
} from '../workout/appPresence.ts';
import { planCatchUp } from '../workout/playhead.ts';
import { runningElapsed } from '../workout/wallClock.ts';

const warmup = { id: 'w', kind: 'warmup', durationMs: 60_000 };
const easy = { id: 'e', kind: 'easy', durationMs: 15_000, repNumber: 1 };
const hard = { id: 'h', kind: 'hard', durationMs: 30_000, repNumber: 1 };
const segments = [warmup, easy, hard];
const totalMs = 105_000;
const running = { running: true, anchored: true };
const paused = { running: false, anchored: false };

type Ride = {
  playhead: number;
  firedClock: Set<string>;
  firedRocky: Set<string>;
  presence: PresenceState;
  spoken: string[];
};

function ride(playhead = 0): Ride {
  return {
    playhead,
    firedClock: new Set(),
    firedRocky: new Set(),
    presence: { ...IDLE_PRESENCE },
    spoken: [],
  };
}

/** The same sample the timer and a foreground return both commit. */
function sample(state: Ride, wallMs: number, workout = segments, total = totalMs): DueCue[] {
  const plan = planCatchUp({
    segments: workout,
    fromMs: state.playhead,
    wallMs,
    totalMs: total,
    firedClock: state.firedClock,
    firedRocky: state.firedRocky,
    salt: 1,
  });
  if (!plan.step.commit) return [];
  state.playhead = plan.step.toMs;
  const played: DueCue[] = [];
  for (const cue of plan.cues) {
    if (!takeCue(state.firedClock, state.firedRocky, cue)) continue;
    state.spoken.push(cue.key);
    played.push(cue);
  }
  return played;
}

function foreground(state: Ride, next: string, rideState: { running: boolean; anchored: boolean }): PresenceEffect {
  const reduced = reduceAppPresence(state.presence, next, rideState);
  state.presence = reduced.state;
  return reduced.effect;
}

function keysOnce(spoken: string[]) {
  const seen = new Map<string, number>();
  for (const key of spoken) seen.set(key, (seen.get(key) ?? 0) + 1);
  for (const [key, count] of seen) assert.equal(count, 1, key);
}

test('the app is in front only while AppState is active', () => {
  assert.equal(isAppInFront('active'), true);
  assert.equal(isAppInFront('inactive'), false);
  assert.equal(isAppInFront('background'), false);
  assert.equal(isAppInFront('unknown'), false);
  assert.equal(isAppInFront('extension'), false);
});

test('background rearms, inactive only snaps, and a paused ride does neither', () => {
  const state = ride();
  assert.equal(foreground(state, 'inactive', running), 'none');
  assert.equal(state.presence.sawBackground, false);
  assert.equal(foreground(state, 'active', running), 'snap');

  assert.equal(foreground(state, 'background', running), 'none');
  assert.equal(state.presence.sawBackground, true);
  assert.equal(foreground(state, 'inactive', running), 'none');
  assert.equal(state.presence.sawBackground, true);
  assert.equal(foreground(state, 'active', running), 'rearm');
  assert.equal(state.presence.sawBackground, false);

  assert.equal(foreground(state, 'extension', running), 'none');
  assert.equal(foreground(state, 'background', paused), 'none');
  assert.equal(foreground(state, 'active', paused), 'none');
  assert.equal(state.presence.sawBackground, false);
});

test('a throttled timer uses the wall gap, and the next tick does not repeat the rung', () => {
  const state = ride(12_900);
  const late = sample(state, 13_400, [easy, hard], 45_000);
  assert.equal(state.playhead, 13_400);
  assert.deepEqual(
    late.filter((cue) => cue.type === 'ladder').map((cue) => cue.type === 'ladder' && cue.step),
    ['two'],
  );
  assert.deepEqual(sample(state, 13_500, [easy, hard], 45_000), []);
  keysOnce(state.spoken);
});

test('a 2.5s stall snaps the clock forward and does not replay the opening', () => {
  const state = ride(0);
  assert.deepEqual(sample(state, 2_500), []);
  assert.equal(state.playhead, 2_500);
  assert.deepEqual(sample(state, 2_600), []);
});

test('steady ticks and one stall fire each opening cue once', () => {
  const state = ride(0);
  for (let wall = 100; wall <= 1_000; wall += 100) sample(state, wall);
  sample(state, 1_600);
  sample(state, 1_700);
  assert.equal(state.spoken.filter((key) => key === 'chirp:w').length, 1);
  assert.equal(state.spoken.filter((key) => key === 'welcome').length, 1);
  keysOnce(state.spoken);
});

test('returning from background catches the wall up once', () => {
  const anchor = 1_700_000;
  const accum = 2_000;
  const state = ride(accum);
  sample(state, accum);
  const away = foreground(state, 'background', running);
  assert.equal(away, 'none');
  assert.equal(state.playhead, accum);

  const now = anchor + 40_000;
  const wall = runningElapsed(now, anchor, accum);
  assert.equal(wall, 42_000);
  const back = foreground(state, 'active', running);
  assert.equal(back, 'rearm');
  const caught = sample(state, wall);
  assert.equal(state.playhead, 42_000);
  assert.deepEqual(caught, []);
  assert.deepEqual(sample(state, wall + 100), []);
  keysOnce(state.spoken);
});

test('a foreground return still inside a Rocky window speaks once', () => {
  const state = ride(10_050);
  assert.equal(foreground(state, 'background', running), 'none');
  assert.equal(foreground(state, 'active', running), 'rearm');
  const caught = sample(state, 11_200, [hard], 30_000);
  assert.equal(caught.some((cue) => cue.key === 'hard:h'), true);
  assert.deepEqual(
    sample(state, 11_300, [hard], 30_000).filter((cue) => cue.key === 'hard:h'),
    [],
  );
  keysOnce(state.spoken);
});

test('Control Center snaps the stalled clock without re-arming, still without a second cue', () => {
  const state = ride(0);
  assert.equal(foreground(state, 'inactive', running), 'none');
  assert.equal(state.playhead, 0);
  assert.equal(foreground(state, 'active', running), 'snap');
  const caught = sample(state, 1_500);
  assert.equal(state.playhead, 1_500);
  assert.equal(caught.some((cue) => cue.key === 'chirp:w'), true);
  assert.equal(caught.some((cue) => cue.key === 'welcome'), true);
  assert.deepEqual(sample(state, 1_600), []);
  keysOnce(state.spoken);
});

test('a paused ride does not catch up when it becomes active again', () => {
  const state = ride(8_000);
  assert.equal(foreground(state, 'background', paused), 'none');
  assert.equal(foreground(state, 'active', paused), 'none');
  assert.equal(state.playhead, 8_000);
  assert.deepEqual(state.spoken, []);
});

test('a backwards clock on return does not reopen a cue', () => {
  const state = ride(0);
  sample(state, 200);
  assert.equal(state.spoken.includes('chirp:w'), true);
  const before = state.spoken.length;
  assert.deepEqual(sample(state, 50), []);
  assert.equal(state.playhead, 200);
  assert.deepEqual(sample(state, 500), []);
  assert.equal(state.spoken.length, before);
});

test('a long background that passes the end finishes without a backlog', () => {
  const state = ride(1_000);
  assert.equal(foreground(state, 'background', running), 'none');
  assert.equal(foreground(state, 'active', running), 'rearm');
  const plan = planCatchUp({
    segments,
    fromMs: state.playhead,
    wallMs: 200_000,
    totalMs,
    firedClock: state.firedClock,
    firedRocky: state.firedRocky,
    salt: 1,
  });
  assert.equal(plan.step.finished, true);
  assert.equal(plan.step.toMs, totalMs);
  assert.deepEqual(plan.cues, []);
  sample(state, 200_000);
  assert.equal(state.playhead, totalMs);
  assert.deepEqual(sample(state, 200_100), []);
});

test('forgetting the fired set would speak again; takeCue is the lock', () => {
  const first = planCatchUp({
    segments: [warmup],
    fromMs: 0,
    wallMs: 100,
    totalMs: 60_000,
    firedClock: new Set(),
    firedRocky: new Set(),
    salt: 0,
  });
  const again = planCatchUp({
    segments: [warmup],
    fromMs: 100,
    wallMs: 200,
    totalMs: 60_000,
    firedClock: new Set(),
    firedRocky: new Set(),
    salt: 0,
  });
  assert.equal(first.cues.some((cue) => cue.key === 'chirp:w'), true);
  assert.equal(again.cues.some((cue) => cue.key === 'chirp:w'), true);
  const firedClock = new Set<string>();
  const firedRocky = new Set<string>();
  assert.equal(takeCue(firedClock, firedRocky, first.cues[0]), true);
  const locked = planCatchUp({
    segments: [warmup],
    fromMs: 100,
    wallMs: 200,
    totalMs: 60_000,
    firedClock,
    firedRocky,
    salt: 0,
  });
  assert.deepEqual(locked.cues, []);
  assert.equal(takeCue(firedClock, firedRocky, first.cues[0]), false);
});
