import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkout } from '../workout/builder.ts';
import { DEFAULT_SETTINGS } from '../workout/defaults.ts';
import { clockText, nextHardRep, rideView } from './rideView.ts';
import { repWatts } from './rideSummary.ts';
import { SKIP_LEAD_MS, warmupEndMs, warmupJumpMs } from '../workout/transport.ts';
import { cuesDue } from '../workout/cueCatchup.ts';
import { gaugeRead } from '../components/ride/gaugeRead.ts';

const workout = buildWorkout(DEFAULT_SETTINGS);

function at(elapsedMs: number) {
  let acc = 0;
  for (let i = 0; i < workout.segments.length; i++) {
    const end = acc + workout.segments[i]!.durationMs;
    if (elapsedMs < end) {
      return rideView({
        segments: workout.segments,
        index: i,
        remainingMs: end - elapsedMs,
        elapsedMs,
        totalMs: workout.totalMs,
        sets: DEFAULT_SETTINGS.sets,
        reps: DEFAULT_SETTINGS.reps,
        workMs: DEFAULT_SETTINGS.workSec * 1000,
        recoverMs: DEFAULT_SETTINGS.recoverSec * 1000,
        hardWatts: workout.hardWatts,
        easyWatts: workout.easyWatts,
      });
    }
    acc = end;
  }
  throw new Error('past end');
}

const warmMs = DEFAULT_SETTINGS.warmupMin * 60_000;

test('clockText is m:ss and rounds up so 0:00 never shows early', () => {
  assert.equal(clockText(18_000), '0:18');
  assert.equal(clockText(17_001), '0:18');
  assert.equal(clockText(522_000), '8:42');
  assert.equal(clockText(3_723_000), '1:02:03');
  assert.equal(clockText(-5), '0:00');
});

test('warm-up shows one bar and no numeric target', () => {
  const view = at(60_000);
  assert.equal(view.phase, 'WARM-UP');
  assert.equal(view.rail.kind, 'bar');
  assert.equal(view.cue.target, false);
  assert.equal(view.countIn, null);
});

test('HARD shows the rep, the set, and the hard target from FTP 120', () => {
  const view = at(warmMs + 12_000);
  assert.equal(view.phase, 'HARD');
  assert.equal(view.context, '1 of 13');
  assert.equal(view.caption, 'Set 1 of 2');
  assert.deepEqual(view.cue, { text: 'Target 144', target: true });
  assert.equal(view.clock, '0:18');
  assert.ok(Math.abs(view.progress - 0.4) < 1e-9);
  assert.equal(view.rail.kind, 'reps');
});

test('the last three seconds of EASY count in to HARD with a rising field', () => {
  const view = at(warmMs + 30_000 + 12_500);
  assert.equal(view.phase, 'EASY');
  assert.equal(view.countIn, 3);
  assert.ok(view.rise != null && view.rise > 0 && view.rise < 0.5);
  assert.deepEqual(view.cue, { text: 'Next 144', target: true });
  const two = at(warmMs + 30_000 + 13_500);
  assert.equal(two.countIn, 2);
});

test('the warm-up counts in to the first HARD too', () => {
  const view = at(warmMs - 1_000);
  assert.equal(view.countIn, 1);
});

test('set rest names the next set and fills the rail', () => {
  const view = at(warmMs + 13 * 45_000 + 60_000);
  assert.equal(view.phase, 'SET REST');
  assert.equal(view.context, 'Set 2 next');
  assert.deepEqual(view.rail, { kind: 'reps', count: 13, done: 13, progress: 0 });
});

test('nextHardRep reads the upcoming rep number', () => {
  const easyIndex = workout.segments.findIndex((s) => s.kind === 'easy');
  assert.equal(nextHardRep(workout.segments, easyIndex), 2);
});

test('repWatts averages each HARD window and skips reps without samples', () => {
  const segs = [
    { kind: 'warmup', durationMs: 10_000 },
    { kind: 'hard', durationMs: 30_000 },
    { kind: 'easy', durationMs: 15_000 },
    { kind: 'hard', durationMs: 30_000 },
  ];
  const samples = [
    { atMs: 11_000, kind: 'hard' as const, watts: 140, bpm: null },
    { atMs: 12_000, kind: 'hard' as const, watts: 150, bpm: null },
    { atMs: 41_000, kind: 'easy' as const, watts: 60, bpm: null },
    { atMs: 60_000, kind: 'hard' as const, watts: null, bpm: 160 },
  ];
  assert.deepEqual(repWatts(segs, samples), [145]);
});


test('warm-up can be halved or skipped, and skip still leaves the count-in', () => {
  const end = warmupEndMs(workout.segments);
  assert.equal(end, warmMs);
  assert.equal(warmupJumpMs(workout.segments, 0, 'halve'), warmMs / 2);
  assert.equal(warmupJumpMs(workout.segments, 600_000, 'halve'), 660_000);
  assert.equal(warmupJumpMs(workout.segments, 60_000, 'skip'), warmMs - SKIP_LEAD_MS);
  assert.equal(warmupJumpMs(workout.segments, warmMs - 5_000, 'skip'), null);
  assert.equal(warmupJumpMs(workout.segments, warmMs + 1_000, 'halve'), null);
});

test('a spoken count-in never skips a ladder', () => {
  const segs = workout.segments;
  const fifthEasy = segs.filter((s) => s.kind === 'easy')[4]!;
  let start = 0;
  for (const s of segs) {
    if (s === fifthEasy) break;
    start += s.durationMs;
  }
  const end = start + fifthEasy.durationMs;
  const args = { segments: segs, fromMs: end - 3_100, toMs: end - 2_900, firedClock: new Set<string>(), firedRocky: new Set<string>() };
  const spoken = cuesDue({ ...args, fullLadder: true }).map((c) => c.type);
  assert.ok(spoken.includes('ladder'));
});


test('the gauge reads under, on, and free without inventing watts', () => {
  assert.equal(gaugeRead(null, 144).state, 'none');
  assert.equal(gaugeRead(128, 144).state, 'under');
  assert.equal(gaugeRead(140, 144).state, 'on');
  assert.equal(gaugeRead(151, 144).state, 'on');
  assert.equal(gaugeRead(96, null).state, 'free');
  assert.equal(gaugeRead(144, 144).targetFrac, 1 / 1.6);
  assert.equal(gaugeRead(999, 144).frac, 1);
});

test('last ride reads sets when finished, time when ended early', async () => {
  const { lastRideLine } = await import('../screens/lastRide.ts');
  const base = { id: 'a', endedAt: '2026-09-24T19:00:00Z', plannedDurationMs: 1, ftpWatts: 120, hardWatts: 144, easyWatts: 60 };
  const now = Date.parse('2026-09-24T20:00:00Z');
  assert.equal(
    lastRideLine([{ ...base, startedAt: '2026-09-24T18:00:00Z', durationMs: 2_740_000, completed: true, completionPct: 100 }], 13, now),
    'Today · Finished',
  );
  assert.equal(
    lastRideLine([{ ...base, startedAt: '2026-09-24T18:00:00Z', durationMs: 734_000, completed: false, completionPct: 27 }], 13, now),
    'Today · Ended early · 12:14',
  );
});

test('warm-up captions count down relative to now, so they stay true after Halve or Skip', () => {
  assert.equal(at(60_000).caption, 'Surges in 9:30');
  const afterSurges = warmMs - 20_000;
  assert.equal(at(afterSurges).caption, 'Main set in 0:20');
});
