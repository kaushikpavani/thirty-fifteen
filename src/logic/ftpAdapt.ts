/**
 * FTP that learns from rides, for riders who don't know theirs.
 *
 * A 30/15 session sets its targets from FTP, so the watts alone mostly
 * echo the setting back. What a ride does reveal is how the rider coped
 * with those targets: whether the last reps held or faded, whether they
 * rode well above target, and (with a strap) how far heart rate drifted
 * and how close it got to max. Each ride is read as too easy, about
 * right, or too hard at the FTP it was ridden with; a change is only
 * suggested when two of the last three such rides agree, and the rider
 * always confirms it.
 *
 * The same idea as TrainerRoad's adaptive training, with simple,
 * explainable rules instead of a model.
 */
import type { WorkoutRecord } from '../types';

export type RideSignal =
  | { kind: 'none' }
  | { kind: 'hold' }
  | { kind: 'up'; ratio: number; late: number; why: 'above-target' | 'easy-heart' }
  | { kind: 'down'; late: number; why: 'faded' | 'drifted' };

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const round5 = (w: number) => Math.round(w / 5) * 5;

/** How one ride went against its own HARD target. Needs a power meter and at least 6 reps. */
export function rideSignal(ride: WorkoutRecord, maxHr: number | null): RideSignal {
  const s = ride.summary;
  const reps = s?.repWatts ?? [];
  const target = ride.hardWatts;
  if (!s || reps.length < 6 || !(target > 0)) return { kind: 'none' };
  const ratio = mean(reps) / target;
  const late = mean(reps.slice(-Math.max(2, Math.floor(reps.length / 3)))) / target;
  const drift = s.decouplingPct ?? null;
  const hardBpm = s.avgHardBpm ?? null;

  // Stopped early but still holding power: probably interrupted, not beaten.
  if (!ride.completed && late >= 0.97) return { kind: 'none' };

  if (late < 0.92) return { kind: 'down', late, why: 'faded' };
  if (drift != null && drift > 10 && late < 0.97) return { kind: 'down', late, why: 'drifted' };

  const heartNotMaxed = hardBpm == null || maxHr == null || hardBpm < 0.92 * maxHr;
  if (ride.completed && ratio >= 1.03 && late >= 1.0 && (drift == null || drift <= 6) && heartNotMaxed) {
    return { kind: 'up', ratio, late, why: 'above-target' };
  }
  // Held the targets with heart rate well short of max and little drift: there's room.
  if (
    ride.completed &&
    ratio >= 0.98 &&
    late >= 0.98 &&
    drift != null &&
    drift <= 4 &&
    hardBpm != null &&
    maxHr != null &&
    hardBpm < 0.85 * maxHr
  ) {
    return { kind: 'up', ratio, late, why: 'easy-heart' };
  }
  return { kind: 'hold' };
}

export type FtpSuggestion = {
  direction: 'raise' | 'lower';
  from: number;
  to: number;
  /** One plain sentence on why. */
  reason: string;
  /** The newest ride this suggestion is based on, for "Not now". */
  latestRideId: string;
};

/**
 * Looks at the last three rides with a signal, ridden at the current FTP.
 * Two that agree (and none against, for a raise) make a suggestion.
 */
export function ftpSuggestion(
  rides: readonly WorkoutRecord[],
  currentFtp: number,
  maxHr: number | null,
): FtpSuggestion | null {
  const recent = rides
    .filter((r) => r.ftpWatts === currentFtp)
    .slice()
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt))
    .map((ride) => ({ ride, signal: rideSignal(ride, maxHr) }))
    .filter((x) => x.signal.kind !== 'none')
    .slice(0, 3);
  if (recent.length < 2) return null;
  const ups = recent.filter((x) => x.signal.kind === 'up');
  const downs = recent.filter((x) => x.signal.kind === 'down');
  const latestRideId = recent[0]!.ride.id;

  if (downs.length >= 2) {
    const late = median(downs.map((x) => (x.signal as { late: number }).late));
    const to = Math.min(currentFtp - 5, round5(currentFtp * clamp(late, 0.92, 0.97)));
    const pct = Math.round(late * 100);
    return {
      direction: 'lower',
      from: currentFtp,
      to,
      reason: `In ${downs.length} of your last ${recent.length} rides your last reps faded to about ${pct}% of the HARD target. A slightly lower FTP keeps every rep at quality.`,
      latestRideId,
    };
  }
  if (ups.length >= 2 && downs.length === 0) {
    const ratios = ups.map((x) => (x.signal as { ratio: number }).ratio);
    const factor = clamp(Math.max(median(ratios), 1.03), 1.03, 1.1);
    const to = Math.max(currentFtp + 5, round5(currentFtp * factor));
    const aboveTarget = ups.some((x) => (x.signal as { why: string }).why === 'above-target');
    const pct = Math.round(median(ratios) * 100);
    return {
      direction: 'raise',
      from: currentFtp,
      to,
      reason: aboveTarget
        ? `In ${ups.length} of your last ${recent.length} rides you averaged about ${pct}% of the HARD target and held it to the last rep. Your targets can go up.`
        : `In ${ups.length} of your last ${recent.length} rides you held every target with your heart rate well short of max and little drift. There's room to go harder.`,
      latestRideId,
    };
  }
  return null;
}

/**
 * A starting FTP for someone who has never measured one: a typical
 * recreational watts-per-kilo for their weight. Rides refine it from there.
 */
export function startingFtp(weightLb: number | null | undefined, sex: 'male' | 'female' | null | undefined): number | null {
  if (weightLb == null || !(weightLb > 0)) return null;
  const kg = weightLb * 0.45359237;
  const wPerKg = sex === 'female' ? 1.9 : sex === 'male' ? 2.2 : 2.0;
  return round5(kg * wPerKg);
}
