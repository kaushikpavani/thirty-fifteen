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

export type RideCheckpoint = ReturnType<typeof createRideCheckpoint>;

/**
 * Next launch: move an interrupted ride into the ride store. Returns it, or
 * null if there was nothing to recover. The checkpoint is only cleared once
 * the ride is safely stored, was already stored, or was thrown away by the rider.
 */
export async function recoverCheckpoint(deps: {
  checkpoint: RideCheckpoint;
  isDeleted: (id: string) => Promise<boolean>;
  isSaved: (id: string) => Promise<boolean>;
  save: (ride: WorkoutRecord) => Promise<boolean>;
}): Promise<WorkoutRecord | null> {
  const ride = await deps.checkpoint.load();
  if (!ride) return null;
  // The rider chose "Delete" for this ride; a checkpoint that landed late must not bring it back.
  if (await deps.isDeleted(ride.id).catch(() => false)) {
    await deps.checkpoint.clear();
    return null;
  }
  // Already saved under its own key (the ride ended normally and only the clean-up was missed):
  // the saved copy is the complete one, so never overwrite it with the in-progress snapshot.
  if (await deps.isSaved(ride.id).catch(() => false)) {
    await deps.checkpoint.clear();
    return null;
  }
  if (!(await deps.save(ride))) return null;
  await deps.checkpoint.clear();
  return ride;
}

/**
 * The rider ended a ride part-way and chose not to keep it. The delete is
 * recorded first, so neither a late checkpoint nor a sync can bring the ride
 * back; then the in-progress copy is removed. False if the delete could not
 * be recorded (the in-progress copy is still removed).
 */
export async function discardCheckpoint(
  deps: { checkpoint: RideCheckpoint; markDeleted: (id: string) => Promise<boolean> },
  id: string,
): Promise<boolean> {
  const recorded = await deps.markDeleted(id).catch(() => false);
  await deps.checkpoint.clear();
  return recorded;
}
