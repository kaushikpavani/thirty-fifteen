import assert from 'node:assert/strict';
import test from 'node:test';
import { WHY_BULLETS, WHY_COMPARE, WHY_COMPARE_TITLE, WHY_HERO, whyCopyBlob } from '../content/why3015.ts';
import { DEFAULT_SETTINGS, derivedWatts } from '../workout/defaults.ts';

test('why sheet hero is the short-hard explanation', () => {
  assert.equal(
    WHY_HERO,
    'Short hard, short easy — so you can stay in the work that grows your engine. That’s why 30/15: more honest time near your limit, not a longer slog that fades.',
  );
});

test('why sheet bullets stay honest about the format, FTP, and limits', () => {
  assert.deepEqual(WHY_BULLETS, [
    '30s hard / 15s easy is a researched cycling short-interval format (Rønnestad-style).',
    'Short recoveries help you pile up work near your aerobic ceiling — time near VO₂max matters for fitness.',
    'HARD / EASY targets come from your FTP (default 125 W → ~150 / ~63 W); edit FTP anytime.',
    'Offline coach: clock + cues; no account required to ride.',
    'Not a medical device — honest intervals for riders who want to get better.',
  ]);
});

test('same clock, different work compares steady riding without a medical promise', () => {
  assert.equal(WHY_COMPARE_TITLE, 'Same clock, different work');
  assert.deepEqual(WHY_COMPARE, [
    'Forty minutes of steady moderate riding keeps you comfortable but rarely near your aerobic ceiling. The same forty minutes as 30/15 (hard / easy) flips you between short hard efforts and short recoveries — so more of the session is spent near the intensity that challenges VO₂max, without needing a longer all-out slog.',
    'You still earn the ride either way. 30/15 just packs more of that high-end work into the same time — a training tool, not a medical promise.',
  ]);
});

test('the default watts in the sheet are the real FTP targets', () => {
  const watts = derivedWatts(DEFAULT_SETTINGS.ftpWatts, DEFAULT_SETTINGS.hardPct, DEFAULT_SETTINGS.easyPct);
  assert.equal(DEFAULT_SETTINGS.ftpWatts, 125);
  assert.equal(watts.hard, 150);
  assert.equal(watts.easy, 63);
  assert.match(WHY_BULLETS[2], /125 W → ~150 \/ ~63 W/);
});

test('why copy does not sell miracles, streaks, or a paywall', () => {
  const blob = whyCopyBlob();
  assert.doesNotMatch(blob, /streak|paywall|subscription|premium|upgrade|miracle|fat-?burn|guarantee|cure/i);
  assert.match(blob, /Not a medical device/);
  assert.match(blob, /no account required/);
});
