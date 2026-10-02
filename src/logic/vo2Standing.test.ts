import assert from 'node:assert/strict';
import test from 'node:test';
import { VO2_NORMS } from '../data/vo2Norms.ts';
import { histogram, levelFor, normBand, percentileOf, standing, valueAtPercentile } from './vo2Standing.ts';

const men40 = normBand(46, 'male');

test('the published deciles come back as exactly those percentiles, for every group', () => {
  for (const sex of ['male', 'female'] as const) {
    for (const band of VO2_NORMS[sex]) {
      band.deciles.forEach((v, i) => {
        assert.ok(Math.abs(percentileOf(v, band) - 10 * (i + 1)) < 0.01, `${sex} ${band.minAge} d${i + 1}`);
      });
      // Deciles are strictly increasing, so percentiles never go backwards.
      for (let i = 1; i < 9; i++) assert.ok(band.deciles[i]! > band.deciles[i - 1]!);
    }
  }
});

test('a 46-year-old man at 38.9 is above average: about the 63rd percentile', () => {
  const s = standing(38.9, 46, 'male');
  assert.equal(s.group, 'men aged 40–49');
  assert.equal(s.percentile, 63);
  assert.equal(s.level, 'Above average');
  assert.equal(s.median, 35.3);
  assert.deepEqual(s.next, { percentile: 70, value: 40.9, gap: 2 });
});

test('percentiles rise smoothly through the tails and stay within 0–100', () => {
  let prev = -1;
  for (let v = 5; v <= 80; v += 0.5) {
    const p = percentileOf(v, men40);
    assert.ok(p >= prev - 1e-9 && p >= 0 && p <= 100, `v=${v} p=${p}`);
    prev = p;
  }
  assert.ok(percentileOf(60, men40) > 97);
  assert.ok(percentileOf(12, men40) < 3);
});

test('valueAtPercentile inverts percentileOf, including the tails', () => {
  for (const p of [2, 5, 10, 25, 50, 63.3, 90, 95, 98]) {
    assert.ok(Math.abs(percentileOf(valueAtPercentile(p, men40), men40) - p) < 0.05, `p=${p}`);
  }
});

test('the histogram accounts for essentially everyone and peaks near the median', () => {
  const { bins, min, max } = histogram(men40);
  const total = bins.reduce((s, b) => s + b.share, 0);
  assert.ok(total > 98 && total <= 100, `total ${total}`);
  assert.ok(bins.every((b) => b.share >= 0));
  const peak = bins.reduce((a, b) => (b.share > a.share ? b : a));
  assert.ok(peak.x0 >= 26 && peak.x1 <= 42, `peak ${peak.x0}-${peak.x1}`);
  assert.ok(min >= 6 && max > 55);
});

test('ages outside 20–89 use the nearest band, and the oldest reads as 80+', () => {
  assert.equal(normBand(17, 'female').minAge, 20);
  assert.equal(normBand(94, 'male').minAge, 80);
  assert.equal(standing(18, 85, 'female').group, 'women aged 80+');
});

test('levels are fifths of the group, with the top 5% called out', () => {
  assert.deepEqual([5, 25, 50, 70, 85, 97].map(levelFor), ['Low', 'Below average', 'Average', 'Above average', 'Excellent', 'Superior']);
  assert.equal(standing(70, 46, 'male').next, null);
});
