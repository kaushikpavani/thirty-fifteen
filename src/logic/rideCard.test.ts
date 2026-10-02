import assert from 'node:assert/strict';
import test from 'node:test';
import type { RideSummary } from '../types.ts';
import { rideBadges, rideCardHtml, rideCardSvg } from './rideCard.ts';
import { standing } from './vo2Standing.ts';

const summary: RideSummary = {
  setsDone: 2,
  setsPlanned: 2,
  durationMs: 2_730_000,
  hardMs: 780_000,
  easyMs: 390_000,
  avgWatts: 117,
  peakWatts: 312,
  avgHardWatts: 187,
  avgEasyWatts: 98,
  workKj: 319,
  sparkline: [],
  avgBpm: 141,
  maxBpm: 168,
  avgHardBpm: 157,
  avgEasyBpm: 150,
  repWatts: [206, 203, 181, 172, 209, 196, 176, 197, 199, 124, 180, 171, 218],
  repBpm: [151, 149, 154, 156, 156, 159, 162, 158, 159, 161, 157, 159, 157],
  efficiencyFactor: 1.2,
  decouplingPct: 0.5,
};
const base = { endedAt: '2026-10-01T19:40:00-07:00', ftpWatts: 120, completed: true, summary };
const vo2 = { estimate: { value: 38.9, low: 36.1, high: 41.6, source: 'hr' as const, parts: { power: null, hr: null }, disagree: false } };

test('the card is one self-contained SVG page with its own background', () => {
  const { svg, width, height } = rideCardSvg({ ...base, hardTarget: 144, repsPerSet: 13 });
  assert.equal(width, 600);
  assert.equal((svg.match(/<svg/g) ?? []).length, 1);
  // The background is drawn as content, so it survives printers that drop CSS backgrounds.
  assert.match(svg, new RegExp(`<rect width="600" height="${height}" fill="#060607"/>`));
  assert.match(svg, />187<tspan/);
  assert.match(svg, /130% of your 144 W target/);
  assert.match(svg, /Every hard rep/);
  assert.doesNotMatch(svg, /undefined|NaN/);
});

test('the page is sized to the card, so the PDF is always a single page', () => {
  const page = rideCardHtml({ ...base, hardTarget: 144, vo2, standing: standing(38.9, 46, 'male') });
  assert.match(page.html, new RegExp(`@page\\{size:600px ${page.height}px;margin:0\\}`));
  const short = rideCardHtml({ ...base, summary: { ...summary, repWatts: [], repBpm: [], efficiencyFactor: null, decouplingPct: null } });
  assert.ok(short.height < page.height);
});

test('fitness standing shows as "Fitter than X%" with the group', () => {
  const { svg } = rideCardSvg({ ...base, vo2, standing: standing(38.9, 46, 'male') });
  assert.match(svg, /Fitter than 69%/);
  assert.match(svg, /of men aged 45–49/);
  assert.match(svg, /FRIEND registry/);
});

test('a ride with no sensors still makes a clean card', () => {
  const bare = { ...summary, avgWatts: null, peakWatts: null, avgHardWatts: null, avgEasyWatts: null, workKj: null, avgBpm: null, maxBpm: null, repWatts: [], repBpm: [], efficiencyFactor: null, decouplingPct: null };
  const { svg } = rideCardSvg({ ...base, completed: false, summary: { ...bare, setsDone: 1 } });
  assert.match(svg, /TIME IN HARD/);
  assert.match(svg, /1 OF 2 SETS · ENDED EARLY/);
  assert.match(svg, /30\/15 ride/);
  assert.doesNotMatch(svg, /Every hard rep|undefined|NaN/);
});

test('rider names are escaped, shortened to a first name, and emails are never shown', () => {
  assert.match(rideCardSvg({ ...base, riderName: 'Sam <b>Rider</b>' }).svg, /Sam’s ride/);
  const email = rideCardSvg({ ...base, riderName: 'someone@example.com' }).svg;
  assert.doesNotMatch(email, /example\.com/);
  assert.match(email, /Ride complete/);
});

test('badges need an earlier ride to beat, and a ride never competes with its own saved copy', () => {
  assert.deepEqual(rideBadges(summary, []), []);
  assert.deepEqual(rideBadges(summary, [{ summary: { ...summary } }]), []);
  const weaker = { ...summary, durationMs: 2_000_000, avgHardWatts: 170, workKj: 280, repWatts: [180, 190], efficiencyFactor: 1.1 };
  assert.deepEqual(rideBadges(summary, [{ summary: weaker }, { summary: { ...summary } }]), [
    'Best hard-rep average yet',
    'Best single rep yet',
    'Best efficiency yet',
    'Most work in one ride',
  ]);
  const stronger = { ...weaker, avgHardWatts: 220, workKj: 400, repWatts: [240], efficiencyFactor: 1.5 };
  assert.deepEqual(rideBadges(summary, [{ summary: stronger }]), []);
});
