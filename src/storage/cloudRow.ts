/**
 * Drop ids that a flush already delivered, using the outbox as it is now.
 * Rows enqueued while the flush was in flight stay queued.
 */
export function withoutSent<T extends { id: string }>(latest: readonly T[], sentIds: ReadonlySet<string>): T[] {
  return latest.filter((item) => !sentIds.has(item.id));
}
