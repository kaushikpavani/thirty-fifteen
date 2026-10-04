import { useEffect, useLayoutEffect, useRef } from 'react';
import { speakCue } from '../audio/cues';
import { createPowerCoach } from '../logic/powerCoach';
import type { WorkoutSettings } from '../types';
import type { EngineState } from './useWorkoutEngine';

/**
 * While the clock runs, once a second, asks the power coach whether the rider
 * has been under the hard target long enough to be nudged, and speaks the
 * answer in the chosen coach's recorded voice (silent if that recording
 * isn't installed yet; never the phone's own voice). `watts` must be null
 * unless a power meter is connected and sending fresh readings, so without a
 * meter this does nothing at all.
 */
export function usePowerCoach(args: { state: EngineState; settings: WorkoutSettings; watts: number | null }) {
  const { state, settings, watts } = args;
  const coach = useRef(createPowerCoach());
  const latest = useRef({ state, settings, watts });
  useLayoutEffect(() => {
    latest.current = { state, settings, watts };
  });

  // A new ride starts clean.
  useEffect(() => {
    coach.current.reset();
  }, [state.startedAt]);

  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(() => {
      try {
        const now = latest.current;
        const seg = now.state.segment;
        if (!seg) return;
        const nudge = coach.current.tick({
          rideMs: now.state.elapsedMs,
          kind: seg.kind,
          repKey: `${now.state.startedAt}:${now.state.segmentIndex}`,
          repElapsedMs: seg.durationMs - now.state.remainingInSegmentMs,
          repRemainingMs: now.state.remainingInSegmentMs,
          watts: now.watts,
          target: now.state.workout.hardWatts,
        });
        if (nudge) speakCue({ key: `power:${nudge.type}`, line: nudge.line, clip: nudge.clip, recordedOnly: true }, now.settings);
      } catch {
        // Coaching is a bonus; it must never disturb the ride.
      }
    }, 1000);
    return () => clearInterval(id);
  }, [state.status]);
}
