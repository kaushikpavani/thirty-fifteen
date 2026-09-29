import type { RideSummary } from '../types';
import { clockText } from './rideView';

export type Stat = { label: string; value: string; unit: string };

/**
 * The headline numbers shown on the finish screen, a past ride, and any
 * shared ride card — kept as pure logic (no React Native imports) so it's
 * usable from the email/PDF templates without pulling in component code.
 */
export function doneStats(summary: RideSummary): Stat[] {
  const out: Stat[] = [];
  if (summary.avgHardWatts != null) out.push({ label: 'Hard avg', value: String(summary.avgHardWatts), unit: 'W' });
  if (summary.avgEasyWatts != null) out.push({ label: 'Easy avg', value: String(summary.avgEasyWatts), unit: 'W' });
  if (summary.workKj != null) out.push({ label: 'Work', value: String(summary.workKj), unit: 'kJ' });
  if (summary.avgBpm != null) out.push({ label: 'Avg heart', value: String(summary.avgBpm), unit: 'bpm' });
  if (summary.maxBpm != null) out.push({ label: 'Max heart', value: String(summary.maxBpm), unit: 'bpm' });
  if (summary.avgHardWatts == null) out.push({ label: 'In HARD', value: clockText(summary.hardMs), unit: '' });
  out.push({ label: 'Time', value: clockText(summary.durationMs), unit: '' });
  return out;
}
