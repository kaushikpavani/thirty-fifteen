import assert from 'node:assert/strict';
import test from 'node:test';
import { tracePath, tracePoints } from './effortTrace.ts';

const set = (reps: number) => Array.from({ length: reps }, () => [{ kind: 'hard' }, { kind: 'easy' }]).flat();
const session = [{ kind: 'warmup' }, ...set(13), { kind: 'set_rest' }, ...set(13), { kind: 'cooldown' }];

test('the trace runs left to right across the whole card and never leaves 0–1', () => {
  const pts = tracePoints(session);
  assert.equal(pts[0]!.x, 0);
  assert.ok(Math.abs(pts[pts.length - 1]!.x - 1) < 1e-9);
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i]!.x >= pts[i - 1]!.x);
  assert.ok(pts.every((p) => p.y >= 0 && p.y <= 1));
});

test('every hard rep is a pulse at full height: 26 for a 2 × 13', () => {
  const pts = tracePoints(session);
  // Each flat stretch contributes two points at the same height.
  assert.equal(pts.filter((p) => p.y === 1).length / 2, 26);
  // The rest between sets sits below the easy level.
  assert.ok(Math.min(...pts.map((p) => p.y)) < 0.22);
});

test('changing the session changes the shape', () => {
  const short = tracePoints([{ kind: 'warmup' }, ...set(5), { kind: 'cooldown' }]);
  assert.equal(short.filter((p) => p.y === 1).length / 2, 5);
});

test('the path fits its box and an empty session draws nothing', () => {
  const d = tracePath(tracePoints(session), 320, 100);
  assert.match(d, /^M0\.0 /);
  const ys = [...d.matchAll(/ (\d+\.\d)(?= L|$)/g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...ys) >= 3 && Math.max(...ys) <= 97);
  assert.equal(tracePath(tracePoints([]), 320, 100), '');
  assert.equal(tracePath(tracePoints(session), 0, 100), '');
});
