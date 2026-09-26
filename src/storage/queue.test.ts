import assert from 'node:assert/strict';
import test from 'node:test';
import { createQueue } from './queue.ts';

test('two outbox-style updates both stick', async () => {
  const run = createQueue();
  let rows: string[] = [];
  const add = (id: string) =>
    run(async () => {
      const current = rows;
      await Promise.resolve();
      rows = [id, ...current];
    });
  await Promise.all([add('a'), add('b')]);
  assert.deepEqual([...rows].sort(), ['a', 'b']);
});

test('a failed job does not block the next write', async () => {
  const run = createQueue();
  const first = run(async () => {
    throw new Error('disk');
  });
  const second = run(async () => 'kept');
  await assert.rejects(first, /disk/);
  assert.equal(await second, 'kept');
});
