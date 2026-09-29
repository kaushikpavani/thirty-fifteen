import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  estimateMaxHr,
  lbToKg,
  vo2FromHr,
  vo2FromPower,
  vo2MaxCategory,
  vo2MaxEstimate,
} from './vo2max.ts';

test('lbToKg converts pounds to kilograms', () => {
  assert.equal(Math.round(lbToKg(165) * 100) / 100, 74.84);
});

test('estimateMaxHr uses the Tanaka formula (208 - 0.7*age)', () => {
  assert.equal(estimateMaxHr(30), 187);
  assert.equal(estimateMaxHr(50), 173);
});

test('vo2FromPower matches a hand-computed ACSM value', () => {
  // FTP 200W, 165 lb (74.8429 kg): MAP = 266.667; VO2 = 10.8*266.667/74.8429 + 7
  const value = vo2FromPower(200, 165)!;
  assert.ok(Math.abs(value - 45.47) < 0.05, `expected ~45.47, got ${value}`);
});

test('vo2FromPower is null without FTP or weight', () => {
  assert.equal(vo2FromPower(0, 165), null);
  assert.equal(vo2FromPower(200, 0), null);
});

test('vo2FromHr matches the Uth ratio formula', () => {
  // resting 55, max 187: 15.3 * (187/55)
  const value = vo2FromHr(55, 187)!;
  assert.ok(Math.abs(value - 52.02) < 0.05, `expected ~52.02, got ${value}`);
});

test('vo2MaxEstimate blends power and HR estimates when both are available', () => {
  const est = vo2MaxEstimate({ ftpWatts: 200, weightLb: 165, ageYears: 30, restingHr: 55 })!;
  assert.equal(est.source, 'blended');
  // average of ~45.47 (power) and ~52.02 (hr from age-estimated max 187)
  assert.ok(Math.abs(est.value - 48.75) < 0.1, `expected ~48.75, got ${est.value}`);
  assert.ok(est.low < est.value && est.value < est.high);
});

test('vo2MaxEstimate prefers an observed max heart rate over the age formula', () => {
  const withAge = vo2MaxEstimate({ restingHr: 55, ageYears: 30 })!;
  const withObserved = vo2MaxEstimate({ restingHr: 55, ageYears: 30, observedMaxBpm: 195 })!;
  assert.notEqual(withAge.value, withObserved.value);
  assert.equal(withObserved.source, 'hr');
});

test('vo2MaxEstimate falls back to a single source when only one is available', () => {
  const powerOnly = vo2MaxEstimate({ ftpWatts: 200, weightLb: 165 })!;
  assert.equal(powerOnly.source, 'power');
  const hrOnly = vo2MaxEstimate({ restingHr: 55, observedMaxBpm: 190 })!;
  assert.equal(hrOnly.source, 'hr');
});

test('vo2MaxEstimate returns null without enough data for either method', () => {
  assert.equal(vo2MaxEstimate({}), null);
  assert.equal(vo2MaxEstimate({ ftpWatts: 200 }), null); // no weight
  assert.equal(vo2MaxEstimate({ restingHr: 55 }), null); // no max HR source
});

test('vo2MaxCategory needs both age and sex to place a value', () => {
  assert.equal(vo2MaxCategory(45, null, 'male'), null);
  assert.equal(vo2MaxCategory(45, 30, null), null);
});

test('vo2MaxCategory matches the Cooper Institute bands at their edges', () => {
  // Male, 20-29: fair upper bound is 42.4
  assert.equal(vo2MaxCategory(42.4, 25, 'male'), 'Fair');
  assert.equal(vo2MaxCategory(42.5, 25, 'male'), 'Good');
  assert.equal(vo2MaxCategory(52.4, 25, 'male'), 'Excellent');
  assert.equal(vo2MaxCategory(52.5, 25, 'male'), 'Superior');
  assert.equal(vo2MaxCategory(10, 25, 'male'), 'Very poor');
  // Female, 30-39
  assert.equal(vo2MaxCategory(40.0, 35, 'female'), 'Excellent');
  assert.equal(vo2MaxCategory(40.1, 35, 'female'), 'Superior');
  // 60+ open-ended band
  assert.equal(vo2MaxCategory(50, 70, 'male'), 'Superior');
});
