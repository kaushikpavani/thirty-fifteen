import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rideEmailHtml, rideEmailSubject, type EmailableRide } from './rideEmail.ts';
import type { RideSummary } from '../types.ts';

const session: EmailableRide = { endedAt: '2026-09-20T18:00:00.000Z', ftpWatts: 220, completed: true };

const summary: RideSummary = {
  setsDone: 2,
  setsPlanned: 2,
  durationMs: 2_400_000,
  hardMs: 780_000,
  easyMs: 390_000,
  avgWatts: 180,
  peakWatts: 320,
  avgHardWatts: 260,
  avgEasyWatts: 110,
  workKj: 430,
  sparkline: [],
  avgBpm: 150,
  maxBpm: 178,
  avgHardBpm: 166,
  avgEasyBpm: 130,
  repWatts: [258, 262, 255, 261],
  repBpm: [160, 165, 168, 172],
  efficiencyFactor: 1.6,
  decouplingPct: 4.2,
};

test('rideEmailSubject names the ride date', () => {
  assert.match(rideEmailSubject(session), /Your 30\/15 ride —/);
});

test('rideEmailHtml includes the headline stats and per-rep table', () => {
  const html = rideEmailHtml(session, summary);
  assert.match(html, /260/); // hard avg watts
  assert.match(html, /Rep by rep/);
  assert.match(html, /Efficiency & recovery/);
});

test('rideEmailHtml has no fitness section without a vo2 estimate', () => {
  const html = rideEmailHtml(session, summary, null);
  assert.doesNotMatch(html, /VO₂max/);
});

test('rideEmailHtml renders the vo2 section, with a range and category, when given one', () => {
  const html = rideEmailHtml(session, summary, {
    estimate: { value: 47.3, low: 44.0, high: 50.6, source: 'blended' },
    category: 'Good',
  });
  assert.match(html, /47\.3/);
  assert.match(html, /44\.0/);
  assert.match(html, /50\.6/);
  assert.match(html, /Good/);
  assert.match(html, /not a lab measurement/);
});
