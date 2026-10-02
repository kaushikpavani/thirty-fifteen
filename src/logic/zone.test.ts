import assert from 'node:assert/strict';
import test from 'node:test';
import type { RideSummary } from '../types.ts';
import { parseStoredSummary, summarizeRide } from './rideSummary.ts';
import { hrSeconds, levelFor, parseHrSecs, zoneCopy, zoneGoalMs, zoneResult } from './zone.ts';

const base: RideSummary = {
  setsDone: 2, setsPlanned: 2, durationMs: 2_730_000, hardMs: 780_000, easyMs: 390_000,
  avgWatts: 117, peakWatts: 312, avgHardWatts: 187, avgEasyWatts: 98, workKj: 319, sparkline: [],
  avgBpm: 141, maxBpm: 168, avgHardBpm: 157, avgEasyBpm: 150,
  repWatts: [206, 203, 181, 172], repBpm: [151, 149, 154, 156],
};

const beats = (pairs: [number, number][]) => pairs.flatMap(([bpm, n]) => Array.from({ length: n }, () => ({ bpm })));

test('the goal is a third of the interval time: 6:30 for a standard 2 × 13', () => {
  assert.equal(zoneGoalMs(base), 390_000);
  assert.equal(zoneGoalMs({ hardMs: 30_000, easyMs: 15_000 }), 60_000);
});

test('time near VO2max is the seconds at or above 90% of max heart rate', () => {
  // Max 170 → the line is 153 bpm. 400 s at or above it, 500 s below.
  const hrSecs = hrSeconds(beats([[140, 500], [153, 100], [160, 250], [170, 50]]))!;
  const r = zoneResult({ summary: { ...base, maxBpm: 170, hrSecs }, observedMaxBpm: 170, ageYears: null, hardTarget: 144 });
  assert.equal(r.kind, 'hr');
  if (r.kind !== 'hr') return;
  assert.deepEqual([r.thresholdBpm, r.ms, r.goalMs, r.level, r.approx, r.maxFrom], [153, 400_000, 390_000, 'reached', false, 'rides']);
  const copy = zoneCopy(r);
  assert.equal(copy.headline, '6:40');
  assert.equal(copy.verdict, 'Goal reached');
  assert.match(copy.footnote!, /153 bpm or higher/);
  assert.match(copy.footnote!, /not a lab measurement/);
});

test('a higher max seen on an earlier ride raises the line', () => {
  const hrSecs = hrSeconds(beats([[150, 600], [160, 100]]))!;
  const r = zoneResult({ summary: { ...base, maxBpm: 160, hrSecs }, observedMaxBpm: 185, ageYears: null, hardTarget: null });
  assert.ok(r.kind === 'hr' && r.thresholdBpm === 167 && r.ms === 0 && r.level === 'missed');
  assert.match(zoneCopy(r).body, /peaked at 160 bpm, below the 167 bpm line/);
});

test('the age estimate is used only while it is higher than anything actually recorded', () => {
  const hrSecs = hrSeconds(beats([[150, 100]]))!;
  const young = zoneResult({ summary: { ...base, maxBpm: 150, hrSecs }, observedMaxBpm: 150, ageYears: 46, hardTarget: null });
  assert.ok(young.kind === 'hr' && young.maxFrom === 'age' && young.maxHr === 176);
  const seen = zoneResult({ summary: { ...base, maxBpm: 181, hrSecs }, observedMaxBpm: 181, ageYears: 46, hardTarget: null });
  assert.ok(seen.kind === 'hr' && seen.maxFrom === 'rides' && seen.maxHr === 181);
});

test('older rides without second-by-second heart rate are counted per rep and say so', () => {
  const repBpm = [151, 149, 154, 156, 156, 159, 162, 158, 159, 161, 157, 159, 157, 150, 153, 155, 154, 160, 157, 158, 157, 159, 159, 163, 157, 157];
  const r = zoneResult({ summary: { ...base, repBpm }, observedMaxBpm: 168, ageYears: null, hardTarget: 144 });
  assert.ok(r.kind === 'hr' && r.approx && r.thresholdBpm === 151);
  if (r.kind !== 'hr') return;
  // 24 of 26 reps average 151 or higher; each rep with its rest is 45 s.
  assert.equal(r.ms, 24 * 45_000);
  assert.match(zoneCopy(r).footnote!, /Estimated per rep/);
});

test('levels: reached at the goal, close from half, touched above zero', () => {
  assert.deepEqual([390_000, 200_000, 5_000, 0].map((ms) => levelFor(ms, 390_000)), ['reached', 'close', 'touched', 'missed']);
});

test('with power only, the card reports reps on target and never claims a VO2max zone', () => {
  const r = zoneResult({ summary: { ...base, maxBpm: null, avgBpm: null, repBpm: [] }, observedMaxBpm: null, ageYears: 46, hardTarget: 180 });
  assert.deepEqual(r, { kind: 'power', held: 3, total: 4, target: 180 });
  const copy = zoneCopy(r);
  assert.equal(copy.headline, '3 of 4');
  assert.doesNotMatch(copy.verdict + copy.headline, /VO/);
});

test('with no sensors it says so and makes no claim', () => {
  const r = zoneResult({ summary: { ...base, maxBpm: null, repWatts: [], repBpm: [] }, observedMaxBpm: null, ageYears: null, hardTarget: 144 });
  assert.equal(r.kind, 'none');
  assert.equal(zoneCopy(r).progress, null);
});

test('heart-rate seconds are saved with the ride and survive storage', () => {
  const samples = [
    ...Array.from({ length: 30 }, (_, i) => ({ atMs: i * 1000, kind: 'hard' as const, watts: 200, bpm: 160 })),
    ...Array.from({ length: 15 }, (_, i) => ({ atMs: (30 + i) * 1000, kind: 'easy' as const, watts: 80, bpm: 150 })),
  ];
  const summary = summarizeRide({
    segments: [{ kind: 'hard', durationMs: 30_000, setNumber: 1 }, { kind: 'easy', durationMs: 15_000, setNumber: 1 }],
    elapsedMs: 45_000, plannedSets: 1, completed: true, samples,
  });
  assert.equal(summary.hrSecs!.secs[160 - summary.hrSecs!.from], 30);
  const back = parseStoredSummary(JSON.parse(JSON.stringify(summary)))!;
  assert.deepEqual(back.hrSecs, summary.hrSecs);
  // No strap: no field at all, and old rides parse as before.
  assert.equal(hrSeconds([{ bpm: null }]), null);
  assert.equal(parseStoredSummary(JSON.parse(JSON.stringify(base)))!.hrSecs, undefined);
  assert.equal(parseHrSecs({ from: 'x', secs: [] }), undefined);
});
