/**
 * One-at-a-time async work.
 * Outbox updates read the list, change it, and write it back. Two of those
 * at once keep the same snapshot and the later write drops the other row.
 * Queue the read and the write together so that cannot happen.
 * A failed job does not stick the queue.
 */
export function createQueue(): <T>(work: () => Promise<T>) => Promise<T> {
  let tail: Promise<void> = Promise.resolve();
  return (work) => {
    const run = tail.then(work, work);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
