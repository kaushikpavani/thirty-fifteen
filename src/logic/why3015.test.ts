import assert from 'node:assert/strict';
import test from 'node:test';
import { WHY_FOOTNOTE, WHY_SECTIONS, whyCopyBlob } from '../content/why3015.ts';
import { DEFAULT_SETTINGS, derivedWatts } from '../workout/defaults.ts';

test('why sheet explains time near VO₂max, cites the research, and keeps Zone 2', () => {
  const titles = WHY_SECTIONS.map((s) => s.title);
  assert.deepEqual(titles, [
    'More time where it counts',
    'Backed by research',
    'A sharpener, not a base',
    'How it should feel',
    'Your targets',
  ]);
  assert.match(whyCopyBlob(), /VO₂max/);
  assert.match(whyCopyBlob(), /Rønnestad et al\., 2015/);
  assert.match(whyCopyBlob(), /Zone 2/);
});

test('the default watts in the sheet are the real FTP targets', () => {
  const watts = derivedWatts(DEFAULT_SETTINGS.ftpWatts, DEFAULT_SETTINGS.hardPct, DEFAULT_SETTINGS.easyPct);
  assert.equal(DEFAULT_SETTINGS.ftpWatts, 120);
  assert.equal(watts.hard, 144);
  assert.equal(watts.easy, 60);
  assert.match(WHY_SECTIONS[4].body, /120 W → 144 \/ 60 W/);
});

test('why copy does not sell miracles, streaks, or a paywall', () => {
  const blob = whyCopyBlob();
  assert.doesNotMatch(blob, /streak|paywall|subscription|premium|upgrade|miracle|fat-?burn|guarantee|cure|honest/i);
  assert.match(WHY_FOOTNOTE, /not a medical device/);
  assert.match(blob, /No account is required/);
});
