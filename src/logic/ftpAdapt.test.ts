import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkoutRecord } from '../types.ts';
import { ftpSuggestion, rideSignal, startingFtp } from './ftpAdapt.ts';

let n = 0;
function ride(opts: {
  ftp?: number;
  reps: number[];
  completed?: boolean;
  drift?: number | null;
  hardBpm?: number | null;
  daysAgo?: number;
}): WorkoutRecord {
  const ftp = opts.ftp ?? 200;
  const ended = new Date(Date.UTC(2026, 8, 30) - (opts.daysAgo ?? 0) * 86_400_000).toISOString();
  return {
    id: `r${n++}`,
    startedAt: ended,
    endedAt: ended,
    durationMs: 2_700_000,
    plannedDurationMs: 2_760_000,
    ftpWatts: ftp,
    hardWatts: Math.round(ftp * 1.2),
    easyWatts: Math.round(ftp * 0.5),
    completed: opts.completed ?? true,
    completionPct: opts.completed === false ? 60 : 100,
    summary: {
      setsDone: 2,
      setsPlanned: 2,
      durationMs: 2_700_000,
      hardMs: 780_000,
      easyMs: 390_000,
      avgWatts: 170,
      peakWatts: 400,
      avgHardWatts: Math.round(opts.reps.reduce((s, x) => s + x, 0) / opts.reps.length),
      avgEasyWatts: 100,
      workKj: 450,
      sparkline: [],
      avgBpm: 150,
      maxBpm: 180,
      avgHardBpm: opts.hardBpm ?? null,
      avgEasyBpm: 140,
      repWatts: opts.reps,
      efficiencyFactor: null,
      decouplingPct: opts.drift ?? null,
    },
  };
}

const flat = (w: number, count = 12) => Array.from({ length: count }, () => w);
const fading = (start: number, end: number, count = 12) =>
  Array.from({ length: count }, (_, i) => Math.round(start + ((end - start) * i) / (count - 1)));

test('a rider who rides well above target, to the last rep, reads as too easy', () => {
  // Target at FTP 200 is 240 W; they ride 260 W throughout.
  assert.equal(rideSignal(ride({ reps: flat(260), drift: 3 }), 185).kind, 'up');
});

test('reps fading well below target read as too hard', () => {
  const s = rideSignal(ride({ reps: fading(240, 190) }), null);
  assert.equal(s.kind, 'down');
});

test('holding targets exactly reads as about right, unless heart rate shows room', () => {
  assert.equal(rideSignal(ride({ reps: flat(240) }), null).kind, 'hold');
  // Held 240 W with HR at 145 of a 185 max (78%) and 2% drift: room to go up.
  const easy = rideSignal(ride({ reps: flat(240), drift: 2, hardBpm: 145 }), 185);
  assert.equal(easy.kind, 'up');
  // Same watts but HR near max: not a reason to raise.
  assert.equal(rideSignal(ride({ reps: flat(240), drift: 2, hardBpm: 176 }), 185).kind, 'hold');
});

test('a ride stopped early while still holding power is ignored, not counted as failure', () => {
  assert.equal(rideSignal(ride({ reps: flat(240, 8), completed: false }), null).kind, 'none');
});

test('no power meter (or too few reps) gives no signal', () => {
  assert.equal(rideSignal(ride({ reps: [] }), null).kind, 'none');
  assert.equal(rideSignal(ride({ reps: flat(260, 4) }), null).kind, 'none');
});

test('one easy ride is not enough; two of the last three suggest a raise, rounded to 5 W', () => {
  const one = [ride({ reps: flat(262), drift: 3, daysAgo: 1 })];
  assert.equal(ftpSuggestion(one, 200, 185), null);
  const two = [...one, ride({ reps: flat(258), drift: 4, daysAgo: 4 }), ride({ reps: flat(240), daysAgo: 7 })];
  const s = ftpSuggestion(two, 200, 185)!;
  assert.equal(s.direction, 'raise');
  assert.equal(s.from, 200);
  assert.equal(s.to % 5, 0);
  assert.ok(s.to >= 205 && s.to <= 220, `to ${s.to}`);
  assert.equal(s.latestRideId, one[0]!.id);
});

test('a big margin above target allows a bigger step, capped at 10%', () => {
  // Default 120 W FTP (target 144) on a rider doing 200 W reps.
  const rides = [ride({ ftp: 120, reps: flat(200), daysAgo: 1 }), ride({ ftp: 120, reps: flat(205), daysAgo: 3 })];
  assert.equal(ftpSuggestion(rides, 120, null)!.to, 130);
});

test('two faded rides suggest lowering by a few percent', () => {
  const rides = [ride({ reps: fading(240, 185), daysAgo: 1 }), ride({ reps: fading(240, 195), daysAgo: 3 })];
  const s = ftpSuggestion(rides, 200, null)!;
  assert.equal(s.direction, 'lower');
  assert.ok(s.to >= 185 && s.to <= 195, `to ${s.to}`);
});

test('mixed signals, or rides at a different FTP, suggest nothing', () => {
  const mixed = [ride({ reps: flat(262), drift: 3, daysAgo: 1 }), ride({ reps: fading(240, 185), daysAgo: 3 })];
  assert.equal(ftpSuggestion(mixed, 200, 185), null);
  const oldFtp = [ride({ ftp: 190, reps: flat(262), daysAgo: 1 }), ride({ ftp: 190, reps: flat(262), daysAgo: 3 })];
  assert.equal(ftpSuggestion(oldFtp, 200, 185), null);
});

test('starting FTP is a typical recreational W/kg for the rider’s weight', () => {
  assert.equal(startingFtp(179, 'male'), 180); // 81.2 kg × 2.2 = 178.6
  assert.equal(startingFtp(140, 'female'), 120); // 63.5 kg × 1.9 = 120.7
  assert.equal(startingFtp(null, 'male'), null);
});

test('time off eases FTP in gentle steps, and short gaps change nothing', async () => {
  const { breakAdjustment } = await import('./ftpAdapt.ts');
  const last = '2026-09-01T18:00:00.000Z';
  const at = (days: number) => Date.parse(last) + days * 86_400_000;
  assert.equal(breakAdjustment(last, at(10), 200), null);
  assert.equal(breakAdjustment(last, at(15), 200)!.to, 195); // 3%
  assert.equal(breakAdjustment(last, at(30), 200)!.to, 190); // 6% → 188 → 190
  assert.equal(breakAdjustment(last, at(60), 200)!.to, 180); // 10%
  assert.match(breakAdjustment(last, at(30), 200)!.reason, /4 weeks since your last ride/);
  assert.equal(breakAdjustment(null, at(30), 200), null);
});
