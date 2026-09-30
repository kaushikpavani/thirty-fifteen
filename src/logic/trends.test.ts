import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkoutRecord } from '../types.ts';
import {
  deltaText,
  METRICS,
  metricPoints,
  periodDelta,
  personalRecords,
  rollingMean,
  weekStart,
  weekStreak,
  weeklyVolume,
} from './trends.ts';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-30T12:00:00Z');

function ride(daysAgo: number, hardW: number | null, extra: Partial<WorkoutRecord['summary']> = {}, ftp = 200): WorkoutRecord {
  const ended = new Date(NOW - daysAgo * DAY).toISOString();
  return {
    id: `d${daysAgo}`,
    startedAt: ended,
    endedAt: ended,
    durationMs: 2_700_000,
    plannedDurationMs: 2_760_000,
    ftpWatts: ftp,
    hardWatts: 240,
    easyWatts: 100,
    completed: true,
    completionPct: 100,
    summary: {
      setsDone: 2,
      setsPlanned: 2,
      durationMs: 2_700_000,
      hardMs: 780_000,
      easyMs: 390_000,
      avgWatts: 180,
      peakWatts: 400,
      avgHardWatts: hardW,
      avgEasyWatts: 100,
      workKj: 480,
      sparkline: [],
      avgBpm: 150,
      maxBpm: 180,
      avgHardBpm: 165,
      avgEasyBpm: 140,
      repWatts: hardW == null ? [] : [hardW - 10, hardW + 12],
      efficiencyFactor: hardW == null ? null : Math.round((hardW / 165) * 100) / 100,
      decouplingPct: 4,
      ...extra,
    },
  };
}

test('points skip rides without the metric and come out oldest first', () => {
  const pts = metricPoints([ride(1, 250), ride(10, null), ride(5, 240)], METRICS.hardWatts);
  assert.deepEqual(pts.map((p) => p.value), [240, 250]);
});

test('rolling mean trails over the last N rides', () => {
  const pts = [100, 200, 300, 400].map((value, i) => ({ t: i, value, rideId: String(i) }));
  assert.deepEqual(rollingMean(pts, 2).map((p) => p.value), [100, 150, 250, 350]);
});

test('4-week delta compares against the 4 weeks before, and higher power reads as better', () => {
  const rides = [ride(40, 230), ride(35, 230), ride(10, 250), ride(3, 254)];
  const d = periodDelta(metricPoints(rides, METRICS.hardWatts), METRICS.hardWatts, '4w', NOW)!;
  assert.equal(d.current, 252);
  assert.equal(d.previous, 230);
  assert.equal(d.good, true);
  assert.equal(deltaText(d, METRICS.hardWatts, 'prior 4 weeks'), '▲ 9.6% vs prior 4 weeks');
});

test('for drift, going down is the good direction and is worded in points, not percent-of-percent', () => {
  const rides = [ride(40, 230, { decouplingPct: 9 }), ride(5, 240, { decouplingPct: 4 })];
  const d = periodDelta(metricPoints(rides, METRICS.drift), METRICS.drift, '4w', NOW)!;
  assert.equal(d.good, true);
  assert.equal(deltaText(d, METRICS.drift, 'prior 4 weeks'), '▼ 5.0 pts vs prior 4 weeks');
});

test('no earlier period means no delta claim, and tiny changes read as "about the same"', () => {
  const only = periodDelta(metricPoints([ride(3, 250)], METRICS.hardWatts), METRICS.hardWatts, '4w', NOW)!;
  assert.equal(only.previous, null);
  assert.equal(deltaText(only, METRICS.hardWatts, 'prior 4 weeks'), null);
  const flat = periodDelta(metricPoints([ride(40, 250), ride(3, 250.5)], METRICS.hardWatts), METRICS.hardWatts, '4w', NOW)!;
  assert.equal(flat.good, null);
  assert.match(deltaText(flat, METRICS.hardWatts, 'prior 4 weeks')!, /About the same/);
});

test('weekly volume includes empty weeks and sums HARD minutes per week', () => {
  const weeks = weeklyVolume([ride(0, 250), ride(0.1, 250), ride(14, 240)], 4, NOW);
  assert.equal(weeks.length, 4);
  assert.equal(weeks[3]!.rides, 2);
  assert.equal(weeks[3]!.hardMinutes, 26);
  assert.equal(weeks[2]!.rides, 0);
  assert.equal(weeks[1]!.rides, 1);
  assert.ok(weeks.every((w) => w.start === weekStart(w.start)));
});

test('streak counts consecutive weeks, and an unfinished current week does not break it', () => {
  // Last week, the week before, and three weeks ago — nothing yet this week.
  const lastWeek = (NOW - weekStart(NOW)) / DAY + 2;
  const rides = [ride(lastWeek, 250), ride(lastWeek + 7, 250), ride(lastWeek + 14, 250), ride(lastWeek + 35, 250)];
  assert.equal(weekStreak(rides, NOW), 3);
  assert.equal(weekStreak([], NOW), 0);
});

test('personal records find the best single rep and link back to the ride', () => {
  const prs = personalRecords([ride(20, 240), ride(3, 262), ride(9, 250)]);
  const rep = prs.find((p) => p.label === 'Best single 30-second rep')!;
  assert.equal(rep.value, '274');
  assert.equal(rep.rideId, 'd3');
  assert.ok(prs.some((p) => p.label === 'Most time in HARD'));
});
