/**
 * Turns the state of a ride (finished, ended early, or still going) into the
 * record that gets saved. One function for all three, so a ride recovered
 * after a crash looks exactly like one the rider ended by hand.
 */
import type { NewWorkoutRecord, WorkoutSettings } from '../types';
import { summarizeRide, type RideSample } from './rideSummary';

/** A ride shorter than this is a mis-tap, not a ride. */
export const MIN_SAVE_MS = 5000;

type Seg = { kind: string; durationMs: number; setNumber?: number };

export function buildRideRecord(args: {
  startedAt: number;
  /** When the ride stopped, or "now" for a ride still in progress. */
  endedAt: number;
  elapsedMs: number;
  completed: boolean;
  workout: { segments: Seg[]; totalMs: number; hardWatts: number; easyWatts: number };
  settings: Pick<WorkoutSettings, 'ftpWatts' | 'sets'>;
  samples: readonly RideSample[];
  /** Minutes actually spent (the playhead minus anything skipped). Defaults to the playhead for older callers. */
  activeMs?: number;
}): NewWorkoutRecord {
  const total = args.workout.totalMs || 1;
  const elapsed = args.completed ? total : Math.max(0, Math.min(args.elapsedMs, total));
  const spent = args.activeMs != null && Number.isFinite(args.activeMs) ? Math.max(0, args.activeMs) : elapsed;
  return {
    startedAt: new Date(args.startedAt).toISOString(),
    endedAt: new Date(args.endedAt).toISOString(),
    durationMs: spent,
    plannedDurationMs: total,
    ftpWatts: args.settings.ftpWatts,
    hardWatts: args.workout.hardWatts,
    easyWatts: args.workout.easyWatts,
    completed: args.completed,
    completionPct: args.completed ? 100 : Math.min(99, Math.round((elapsed / total) * 100)),
    summary: summarizeRide({
      segments: args.workout.segments,
      elapsedMs: elapsed,
      plannedSets: args.settings.sets,
      completed: args.completed,
      samples: args.samples as RideSample[],
      activeMs: spent,
    }),
  };
}
