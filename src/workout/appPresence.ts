/**
 * What a running ride does when AppState changes.
 * Leaving the app does not pause the workout. The clock catches up on the way back.
 * A real `background` re-arms the audio session. `inactive` (Control Center) only
 * snaps the clock and kicks the bed.
 */

export type PresenceState = { sawBackground: boolean };

export type PresenceEffect = 'none' | 'snap' | 'rearm';

export type RidePresence = { running: boolean; anchored: boolean };

export const IDLE_PRESENCE: PresenceState = { sawBackground: false };

/** True only while this app is the foreground app. Animations follow this. The ride does not. */
export function isAppInFront(state: string): boolean {
  return state === 'active';
}

export function reduceAppPresence(
  state: PresenceState,
  next: string,
  ride: RidePresence,
): { state: PresenceState; effect: PresenceEffect } {
  let sawBackground = state.sawBackground;
  if (next === 'background') sawBackground = true;
  if (next !== 'active') return { state: { sawBackground }, effect: 'none' };
  const leftApp = sawBackground;
  sawBackground = false;
  if (!ride.running || !ride.anchored) return { state: { sawBackground }, effect: 'none' };
  return { state: { sawBackground }, effect: leftApp ? 'rearm' : 'snap' };
}
