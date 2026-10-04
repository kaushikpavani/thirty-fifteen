/**
 * The ride in progress, written to the phone every few seconds.
 *
 * A ride used to be saved only when it ended. If the battery died, the app
 * crashed, or iOS killed it in the background, the whole ride was gone. Now
 * the latest state of the ride sits under one key while it runs; a normal
 * finish clears it, and if the app ever starts up and finds one, that ride
 * is saved as "ended early" with everything recorded up to the last write.
 *
 * Pure over a small key-value interface so it can be tested without React
 * Native; history.ts wires it to AsyncStorage.
 */
import type { WorkoutRecord } from '../types';
import { parseRecord } from './rideStore';

export const CHECKPOINT_KEY = '@thirtyfifteen/rides/in-progress/v1';
/** How often the running ride is written. At worst this much of a ride is lost. */
export const CHECKPOINT_EVERY_MS = 10_000;

export type CheckpointKv = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function createRideCheckpoint(kv: CheckpointKv) {
  /** Overwrites the previous checkpoint. Never throws: a failed write must not disturb the ride. */
  async function save(ride: WorkoutRecord): Promise<boolean> {
    try {
      await kv.setItem(CHECKPOINT_KEY, JSON.stringify(ride));
      return true;
    } catch {
      return false;
    }
  }

  /** The interrupted ride, or null if there isn't one or it can't be read. */
  async function load(): Promise<WorkoutRecord | null> {
    try {
      const raw = await kv.getItem(CHECKPOINT_KEY);
      if (!raw) return null;
      return parseRecord(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async function clear(): Promise<void> {
    try {
      await kv.removeItem(CHECKPOINT_KEY);
    } catch {
      // A stale checkpoint is harmless: it has the same id as the saved ride, so it can't duplicate it.
    }
  }

  return { save, load, clear };
}
