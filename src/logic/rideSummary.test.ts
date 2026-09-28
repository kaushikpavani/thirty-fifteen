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
