import { POWER_LINES } from '../logic/powerCoach.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { COACH_LANGUAGES, COACH_LINES } from './coachLines.ts';
import { EASY_LINES, HARD_LINES, LAST_ONE, ROCKY_DONE, WARMUP_ONE_LEFT } from './rocky.ts';
import { clipFor, clipsForRide, coachLanguage, nextTake, normalizeCoach, resolveClip, voiceName } from './voices.ts';
import { cuesDue } from '../workout/cueCatchup.ts';

const settings = { coachLanguage: 'en', warmupMin: 12, betweenSetRestMin: 4, cooldownMin: 10 };
const script = JSON.parse(readFileSync(new URL('../../assets/voice/script.en.json', import.meta.url), 'utf8'));

test('each language has a female and a male coach, and English is the only one for now', () => {
  assert.deepEqual(COACH_LANGUAGES.map((l) => l.id), ['en']);
  assert.deepEqual(Object.keys(COACH_LANGUAGES[0]!.coaches).sort(), ['female', 'male']);
  assert.equal(voiceName('female'), 'Sarah');
  assert.equal(voiceName('male'), 'Chris');
  assert.equal(voiceName('off'), 'Off');
});

test('old voice choices and unknown languages fall back safely', () => {
  assert.deepEqual(['direct', 'calm', 'numbers', undefined, 'male', 'off'].map(normalizeCoach), ['female', 'female', 'female', 'female', 'male', 'off']);
  assert.equal(coachLanguage({ coachLanguage: 'xx' }), 'en');
});

test('the warm-up, set rest and cool-down lines say the length from the rider’s settings', () => {
  assert.deepEqual(resolveClip({ key: 'welcome', clip: 'welcome', line: '' }, settings), { clip: 'warmup12', line: 'Warm-up. Twelve minutes, easy spin.' });
  assert.deepEqual(resolveClip({ key: 'round:x', clip: 'round0', line: '' }, settings), { clip: 'rest4', line: 'Set done. Four minutes easy. Take a drink.' });
  assert.deepEqual(resolveClip({ key: 'finish', clip: 'finish0', line: '' }, settings), { clip: 'cooldown10', line: 'That’s the work. Cool-down, ten minutes easy.' });
  assert.equal(resolveClip({ key: 'round:x', clip: 'round0', line: '' }, { ...settings, betweenSetRestMin: 1 })!.line, 'Set done. One minute easy. Take a drink.');
});

test('the script has a line for every length the settings allow', () => {
  const have = new Set(Object.keys(COACH_LINES.en!));
  for (let n = 5; n <= 30; n++) assert.ok(have.has(clipFor('welcome', { ...settings, warmupMin: n })), `warm-up ${n}`);
  for (let n = 1; n <= 10; n++) assert.ok(have.has(clipFor('round0', { ...settings, betweenSetRestMin: n })), `rest ${n}`);
  for (let n = 3; n <= 20; n++) assert.ok(have.has(clipFor('finish0', { ...settings, cooldownMin: n })), `cool-down ${n}`);
  // Out-of-range settings clamp to a line that exists rather than going silent.
  assert.equal(clipFor('welcome', { ...settings, warmupMin: 45 }), 'warmup30');
});

test('a ride loads only the lines it can use', () => {
  const all = Object.keys(COACH_LINES.en!);
  const mine = clipsForRide(all, settings);
  assert.ok(mine.includes('warmup12') && mine.includes('rest4') && mine.includes('cooldown10'));
  assert.equal(mine.filter((c) => /^(warmup|rest|cooldown)\d+$/.test(c)).length, 3);
  assert.ok(mine.includes('go') && mine.includes('warmup1left') && mine.includes('done'));
  assert.ok(mine.length < all.length / 2);
});

test('the spoken script matches the lines the timing code falls back to', () => {
  const en = COACH_LINES.en!;
  HARD_LINES.forEach((line, i) => assert.equal(en[`hard${i}`], line));
  EASY_LINES.forEach((line, i) => assert.equal(en[`easy${i}`], line));
  assert.equal(en.last, LAST_ONE);
  assert.equal(en.done, ROCKY_DONE);
  assert.equal(en.warmup1left, WARMUP_ONE_LEFT);
  for (const [clip, line] of Object.entries(POWER_LINES)) assert.equal(en[clip], line, clip);
  // The generated file is in step with the script it was generated from.
  assert.deepEqual(Object.keys(en), script.lines.map((l: { clip: string }) => l.clip));
});

test('takes rotate, so the same recording never plays twice in a row', () => {
  assert.deepEqual([undefined, 0, 1, 2].map((last) => nextTake(3, last)), [0, 1, 2, 0]);
  assert.equal(nextTake(1, 0), 0);
});

test('the rider hears "one minute of warm-up left" a minute before the first hard rep', () => {
  const segments = [
    { id: 'w', kind: 'warmup', durationMs: 600_000 },
    { id: 'h1', kind: 'hard', durationMs: 30_000, repNumber: 1 },
    { id: 'e1', kind: 'easy', durationMs: 15_000, repNumber: 1 },
    { id: 'cd', kind: 'cooldown', durationMs: 1_200_000 },
  ];
  const due = cuesDue({ segments, fromMs: 539_900, toMs: 540_100, firedClock: new Set(), firedRocky: new Set(['welcome']) });
  const cue = due.find((c) => c.key === 'warmup:left1');
  assert.ok(cue && cue.type === 'remaining' && cue.clip === 'warmup1left');
  // Not repeated, and not said at all when the warm-up is too short for it to be news.
  assert.equal(cuesDue({ segments, fromMs: 539_900, toMs: 540_100, firedClock: new Set(['warmup:left1']), firedRocky: new Set(['welcome']) }).some((c) => c.key === 'warmup:left1'), false);
  const short = [{ id: 'w', kind: 'warmup', durationMs: 120_000 }, ...segments.slice(1)];
  assert.equal(cuesDue({ segments: short, fromMs: 59_900, toMs: 60_100, firedClock: new Set(), firedRocky: new Set(['welcome']) }).some((c) => c.key === 'warmup:left1'), false);
});
