import { clockText } from '../logic/rideView';
import type { WorkoutRecord } from '../types';

/** The one-line "Last ride" summary on Home. */
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function lastRideLine(sessions: WorkoutRecord[], reps: number, now = Date.now()): string | null {
  if (sessions.length === 0) return null;
  const last = sessions.reduce((a, b) => (Date.parse(b.startedAt) > Date.parse(a.startedAt) ? b : a));
  const at = new Date(last.startedAt);
  if (Number.isNaN(at.getTime())) return null;
  const days = Math.floor((now - at.getTime()) / 86_400_000);
  const when = days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? WEEKDAY[at.getDay()] : `${days} days ago`;
  const what = last.completed
    ? last.summary ? `${last.summary.setsDone} × ${reps}` : 'Finished'
    : `Ended early · ${clockText(last.durationMs)}`;
  const hard = last.summary?.avgHardWatts != null ? ` · ${last.summary.avgHardWatts} W hard avg` : '';
  return `${when} · ${what}${hard}`;
}
