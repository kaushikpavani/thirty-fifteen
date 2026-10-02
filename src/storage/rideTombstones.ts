/**
 * Rides the rider deleted one at a time.
 *
 * Backup sync is additive: anything in the cloud that isn't on the phone
 * gets downloaded. Without a record of single deletes, a ride deleted while
 * offline (or whose cloud delete failed) would come straight back on the
 * next sync. These ids are never downloaded or uploaded again, and each
 * sync retries removing them from the cloud until it succeeds.
 *
 * Pure over a small key-value interface so it can be tested without React
 * Native; history.ts wires it to AsyncStorage.
 */
export const TOMBSTONE_KEY = '@thirtyfifteen/rides/deleted/v1';

export type TombstoneKv = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export function parseTombstones(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  } catch {
    return [];
  }
}

export function createTombstones(kv: TombstoneKv) {
  let memory: Set<string> | null = null;

  async function load(): Promise<Set<string>> {
    if (memory) return memory;
    const disk = parseTombstones(await kv.getItem(TOMBSTONE_KEY));
    // A delete may have landed in memory while the disk read was in flight.
    const merged = new Set<string>(disk);
    for (const id of (memory as Set<string> | null) ?? []) merged.add(id);
    memory = merged;
    return memory;
  }

  /** Record a delete. Throws if it can't be written, so the caller can leave the ride alone. */
  async function add(id: string): Promise<void> {
    const next = new Set(await load());
    next.add(id);
    await kv.setItem(TOMBSTONE_KEY, JSON.stringify([...next]));
    memory = next;
  }

  return { load, add };
}
