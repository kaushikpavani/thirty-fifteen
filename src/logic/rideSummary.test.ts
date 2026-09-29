import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStoredSummary, setsFinished, summarizeRide, timeInKind, type RideSample } from './rideSummary.ts';

const segments = [
  { kind: 'warmup', durationMs: 10_000 },
  { kind: 'hard', durationMs: 30_000, setNumber: 1 },
  { kind: 'easy', durationMs: 15_000, setNumber: 1 },
  { kind: 'hard', durationMs: 30_000, setNumber: 2 },
  { kind: 'easy', durationMs: 15_000, setNumber: 2 },
];

test('time and sets come from the timeline, not from invented sensors', () => {
  assert.equal(timeInKind(segments, 55_000, 'hard'), 30_000);
  assert.equal(timeInKind(segments, 55_000, 'easy'), 15_000);
  assert.equal(setsFinished(segments, 55_000, 2), 1);
  const summary = summarizeRide({
    segments,
    elapsedMs: 55_000,
    plannedSets: 2,
    completed: false,
    samples: [],
  });
  assert.equal(summary.setsDone, 1);
  assert.equal(summary.setsPlanned, 2);
  assert.equal(summary.avgWatts, null);
  assert.equal(summary.peakWatts, null);
  assert.equal(summary.workKj, null);
  assert.deepEqual(summary.sparkline, []);
  assert.equal(summary.avgBpm, null);
  assert.equal(summary.maxBpm, null);
});

test('power and heart rate averages ignore gaps and keep a real zero watt', () => {
  const samples: RideSample[] = [
    { atMs: 10_000, kind: 'hard', watts: 200, bpm: 150 },
    { atMs: 20_000, kind: 'hard', watts: 0, bpm: 160 },
    { atMs: 40_000, kind: 'easy', watts: 100, bpm: 120 },
    { atMs: 50_000, kind: 'easy', watts: null, bpm: null },
  ];
  const summary = summarizeRide({
    segments,
    elapsedMs: 100_000,
    plannedSets: 2,
    completed: true,
    samples,
  });
  assert.equal(summary.setsDone, 2);
  assert.equal(summary.avgWatts, 100);
  assert.equal(summary.peakWatts, 200);
  assert.equal(summary.avgHardWatts, 100);
  assert.equal(summary.avgEasyWatts, 100);
  assert.equal(summary.workKj, 2);
  assert.deepEqual(summary.sparkline, [200, 0, 100]);
  assert.equal(summary.avgBpm, 143);
  assert.equal(summary.maxBpm, 160);
  assert.equal(summary.avgHardBpm, 155);
  assert.equal(summary.avgEasyBpm, 120);
});

test('a stored summary round-trips and junk is dropped', () => {
  const summary = summarizeRide({
    segments,
    elapsedMs: 55_000,
    plannedSets: 2,
    completed: false,
    samples: [{ atMs: 0, kind: 'hard', watts: 180, bpm: null }],
  });
  assert.deepEqual(parseStoredSummary(summary), summary);
  assert.equal(parseStoredSummary(null), undefined);
  assert.equal(parseStoredSummary({ setsDone: '2' }), undefined);
});

test('efficiency factor and HR:Power drift come from paired rep watts and bpm', () => {
  const hardOnly = [
    { kind: 'hard', durationMs: 30_000 },
    { kind: 'hard', durationMs: 30_000 },
    { kind: 'hard', durationMs: 30_000 },
    { kind: 'hard', durationMs: 30_000 },
  ];
  const samples: RideSample[] = [
    { atMs: 15_000, kind: 'hard', watts: 200, bpm: 140 },
    { atMs: 45_000, kind: 'hard', watts: 200, bpm: 140 },
    { atMs: 75_000, kind: 'hard', watts: 200, bpm: 160 },
    { atMs: 105_000, kind: 'hard', watts: 200, bpm: 160 },
  ];
  const summary = summarizeRide({
    segments: hardOnly,
    elapsedMs: 120_000,
    plannedSets: 1,
    completed: true,
    samples,
  });
  assert.deepEqual(summary.repWatts, [200, 200, 200, 200]);
  assert.deepEqual(summary.repBpm, [140, 140, 160, 160]);
  // 200 W / 150 bpm average, rounded to one decimal.
  assert.equal(summary.efficiencyFactor, 1.3);
  // First-half EF 200/140, second-half EF 200/160: a 12.5% drift.
  assert.equal(summary.decouplingPct, 12.5);

  const round = parseStoredSummary(summary);
  assert.deepEqual(round, summary);
});

test('efficiency insights are null without enough sensors or reps, never invented', () => {
  const short = summarizeRide({
    segments: [{ kind: 'hard', durationMs: 30_000 }],
    elapsedMs: 30_000,
    plannedSets: 1,
    completed: true,
    samples: [{ atMs: 0, kind: 'hard', watts: 200, bpm: 140 }],
  });
  // Only one rep: not enough to split in half for a drift number.
  assert.equal(short.decouplingPct, null);
  // A single rep still gets an efficiency factor — it does not need a split.
  assert.equal(short.efficiencyFactor, 1.4);

  const noHr = summarizeRide({
    segments: [{ kind: 'hard', durationMs: 30_000 }],
    elapsedMs: 30_000,
    plannedSets: 1,
    completed: true,
    samples: [{ atMs: 0, kind: 'hard', watts: 200, bpm: null }],
  });
  assert.equal(noHr.efficiencyFactor, null);
  assert.equal(noHr.decouplingPct, null);
});

test('a summary saved before efficiency metrics existed still parses', () => {
  const legacy = {
    setsDone: 2,
    setsPlanned: 2,
    durationMs: 100_000,
    hardMs: 60_000,
    easyMs: 30_000,
    avgWatts: 150,
    peakWatts: 200,
    avgHardWatts: 180,
    avgEasyWatts: 100,
    workKj: 15,
    sparkline: [150, 160],
    avgBpm: 140,
    maxBpm: 160,
    avgHardBpm: 150,
    avgEasyBpm: 120,
  };
  const parsed = parseStoredSummary(legacy);
  assert.ok(parsed);
  assert.deepEqual(parsed?.repWatts, []);
  assert.deepEqual(parsed?.repBpm, []);
  assert.equal(parsed?.efficiencyFactor, null);
  assert.equal(parsed?.decouplingPct, null);
});
