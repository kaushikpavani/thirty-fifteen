/**
 * Rides on this phone, one storage key per ride.
 *
 * The rule this module exists to enforce: a ride that reached the phone
 * stays on the phone until the rider explicitly deletes it (one ride, or
 * their whole history).
 * Nothing here rewrites "the list" — rides are only ever added (or
 * re-written under their own id), so a bad sync response, a failed read,
 * or a crash mid-write can at worst affect one ride, never erase the rest.
 *
 * Pure over a small key-value interface so it can be tested without React
 * Native; history.ts wires it to AsyncStorage.
 */
import type { WorkoutRecord } from '../types';
import { parseStoredSummary } from '../logic/rideSummary';

export type KeyValue = {
  getAllKeys(): Promise<readonly string[]>;
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
};

export const RIDE_PREFIX = '@thirtyfifteen/rides/v2/';
/** The old single-blob history. Read once to migrate, then left alone until the rider deletes history. */
export const LEGACY_KEY = '@thirtyfifteen/history/v1';
export const MIGRATED_KEY = '@thirtyfifteen/rides/v2-migrated';

function isRecordShape(value: unknown): value is WorkoutRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<WorkoutRecord>;
  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    typeof record.startedAt === 'string' &&
    typeof record.endedAt === 'string' &&
    typeof record.durationMs === 'number' &&
    typeof record.plannedDurationMs === 'number' &&
    typeof record.ftpWatts === 'number' &&
    typeof record.hardWatts === 'number' &&
    typeof record.easyWatts === 'number' &&
    typeof record.completed === 'boolean' &&
    typeof record.completionPct === 'number'
  );
}

/** A stored or downloaded ride, validated. Null if it isn't one. */
export function parseRecord(value: unknown): WorkoutRecord | null {
  if (!isRecordShape(value)) return null;
  const summary = parseStoredSummary((value as { summary?: unknown }).summary);
  const { summary: _raw, ...rest } = value as WorkoutRecord & { summary?: unknown };
  void _raw;
  return summary ? { ...rest, summary } : rest;
}

/** Newest first. Never truncates — every ride on the phone is shown. */
export function sortRides(rides: WorkoutRecord[]): WorkoutRecord[] {
  return rides.slice().sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
}

export type StoreRead = {
  /** False if anything couldn't be read. Nothing is lost either way — reads never write. */
  ok: boolean;
  rides: WorkoutRecord[];
};

export function createRideStore(kv: KeyValue) {
  const keyFor = (id: string) => `${RIDE_PREFIX}${id}`;

  /**
   * Copy rides from the old single blob into per-ride keys, once. The blob
   * itself is not deleted here: if anything goes wrong it is still there to
   * retry from next launch. Returns false if the blob couldn't be read.
   */
  async function migrateLegacy(): Promise<boolean> {
    if ((await kv.getItem(MIGRATED_KEY)) === '1') return true;
    const raw = await kv.getItem(LEGACY_KEY);
    if (raw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return false;
      }
      if (!Array.isArray(parsed)) return false;
      for (const item of parsed) {
        const ride = parseRecord(item);
        if (!ride) continue;
        // Never clobber a ride that already has its own key.
        if ((await kv.getItem(keyFor(ride.id))) == null) {
          await kv.setItem(keyFor(ride.id), JSON.stringify(ride));
        }
      }
    }
    await kv.setItem(MIGRATED_KEY, '1');
    return true;
  }

  async function read(): Promise<StoreRead> {
    let ok = true;
    try {
      ok = await migrateLegacy();
    } catch {
      ok = false;
    }
    let keys: readonly string[];
    try {
      keys = (await kv.getAllKeys()).filter((key) => key.startsWith(RIDE_PREFIX));
    } catch {
      return { ok: false, rides: [] };
    }
    if (keys.length === 0) return { ok, rides: [] };
    let pairs: readonly (readonly [string, string | null])[];
    try {
      pairs = await kv.multiGet(keys);
    } catch {
      return { ok: false, rides: [] };
    }
    const rides: WorkoutRecord[] = [];
    for (const [, value] of pairs) {
      if (value == null) continue;
      try {
        const ride = parseRecord(JSON.parse(value));
        if (ride) rides.push(ride);
        else ok = false;
      } catch {
        ok = false; // one unreadable ride doesn't hide the others
      }
    }
    return { ok, rides: sortRides(rides) };
  }

  /** Add or update rides under their own ids. Never removes anything. */
  async function put(rides: WorkoutRecord[]): Promise<void> {
    for (const ride of rides) {
      await kv.setItem(keyFor(ride.id), JSON.stringify(ride));
    }
  }

  /** The rider asked to delete their history. The only path that removes rides. */
  async function removeAll(): Promise<void> {
    const keys = (await kv.getAllKeys()).filter((key) => key.startsWith(RIDE_PREFIX));
    await kv.multiRemove([...keys, LEGACY_KEY]);
    await kv.setItem(MIGRATED_KEY, '1');
  }

  /** The rider asked to delete these specific rides. Touches only their keys. */
  async function remove(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await kv.multiRemove(ids.map(keyFor));
  }

  /** Whether a ride with this id is already stored. */
  async function has(id: string): Promise<boolean> {
    return (await kv.getItem(keyFor(id))) != null;
  }

  return { read, put, has, remove, removeAll };
}

export type RideStore = ReturnType<typeof createRideStore>;
