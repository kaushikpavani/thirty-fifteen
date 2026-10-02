/**
 * Did the ride do what 30/15 is for?
 *
 * The point of short intervals is to pile up minutes near VO2max (roughly
 * 90% of it and above): the 15-second rests are too short for oxygen
 * uptake to fall, so it stays high across the whole set. Measuring oxygen
 * needs a lab mask, so, like coaches do in the field, this uses the
 * standard stand-in: time with heart rate at or above 90% of max.
 *
 * Heart rate lags behind oxygen uptake by tens of seconds at the start of
 * each set, so if anything this under-counts. It is a guide, not a lab
 * measurement, and the screen says so.
 */
import type { RideSummary } from '../types';

export const ZONE_FRACTION = 0.9;
/** Heart-rate seconds are kept per bpm from here up; nothing below matters for the zone. */
export const HR_FROM = 80;
export const HR_TO = 230;

export type HrSecs = { from: number; secs: number[] };

/** Seconds spent at each heart rate, from once-a-second samples. Null without a strap. */
export function hrSeconds(samples: readonly { bpm: number | null }[]): HrSecs | null {
  const secs = new Array<number>(HR_TO - HR_FROM + 1).fill(0);
  let any = false;
  for (const sample of samples) {
    const bpm = sample.bpm;
    if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) continue;
    any = true;
    const i = Math.round(bpm) - HR_FROM;
    if (i >= 0 && i < secs.length) secs[i]! += 1;
  }
  if (!any) return null;
  let last = secs.length - 1;
  while (last > 0 && secs[last] === 0) last -= 1;
  return { from: HR_FROM, secs: secs.slice(0, last + 1) };
}

export function parseHrSecs(raw: unknown): HrSecs | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Partial<HrSecs>;
  if (typeof row.from !== 'number' || !Number.isFinite(row.from) || !Array.isArray(row.secs)) return undefined;
  const secs = row.secs.slice(0, 400).map((n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : 0));
  return { from: Math.round(row.from), secs };
}

function secondsAtOrAbove(hr: HrSecs, bpm: number): number {
  let total = 0;
  for (let i = Math.max(0, bpm - hr.from); i < hr.secs.length; i++) total += hr.secs[i]!;
  return total;
}

export type ZoneLevel = 'reached' | 'close' | 'touched' | 'missed';

export type ZoneResult =
  | {
      kind: 'hr';
      level: ZoneLevel;
      /** Time at or above the threshold. */
      ms: number;
      /** What a solid session of this size should reach. */
      goalMs: number;
      thresholdBpm: number;
      maxHr: number;
      maxFrom: 'rides' | 'age';
      /** True for rides saved before second-by-second heart rate was kept: counted per rep instead. */
      approx: boolean;
      peakBpm: number | null;
    }
  | { kind: 'power'; held: number; total: number; target: number }
  | { kind: 'none' };

/**
 * A third of the interval time (hard plus the short rests between) is the
 * goal: the first minute or two of each set is spent climbing into the
 * zone, and a good set then stays there. For the standard 2 × 13 that is
 * 6:30 of 19:30. This is the app's own yardstick, not a number from a study.
 */
export function zoneGoalMs(summary: Pick<RideSummary, 'hardMs' | 'easyMs'>): number {
  const third = (summary.hardMs + summary.easyMs) / 3;
  return Math.max(60_000, Math.round(third / 30_000) * 30_000);
}

export function levelFor(ms: number, goalMs: number): ZoneLevel {
  if (ms >= goalMs) return 'reached';
  if (ms >= goalMs / 2) return 'close';
  if (ms > 0) return 'touched';
  return 'missed';
}

export function zoneResult(input: {
  summary: RideSummary;
  /** Highest heart rate seen on any ride, this one included. */
  observedMaxBpm: number | null;
  ageYears: number | null;
  hardTarget: number | null;
}): ZoneResult {
  const { summary } = input;
  const rideMax = summary.maxBpm ?? null;
  if (rideMax != null) {
    const observed = Math.max(input.observedMaxBpm ?? 0, rideMax);
    // A max seen on a ride is the rider's own; the age formula is only a starting point,
    // used while it is still higher than anything they have actually hit.
    const fromAge = input.ageYears != null ? Math.round(208 - 0.7 * input.ageYears) : null;
    const useAge = fromAge != null && fromAge > observed;
    const maxHr = useAge ? fromAge : observed;
    const thresholdBpm = Math.round(maxHr * ZONE_FRACTION);
    const goalMs = zoneGoalMs(summary);
    let ms: number;
    let approx = false;
    if (summary.hrSecs) {
      ms = secondsAtOrAbove(summary.hrSecs, thresholdBpm) * 1000;
    } else {
      // Older rides only kept each hard rep's average heart rate. Count a rep (and the short
      // rest after it) when that average clears the line.
      const reps = summary.repBpm ?? [];
      const perRep = reps.length > 0 ? (summary.hardMs + summary.easyMs) / reps.length : 0;
      ms = Math.round(reps.filter((bpm) => bpm >= thresholdBpm).length * perRep);
      approx = true;
    }
    return {
      kind: 'hr',
      level: levelFor(ms, goalMs),
      ms,
      goalMs,
      thresholdBpm,
      maxHr,
      maxFrom: useAge ? 'age' : 'rides',
      approx,
      peakBpm: rideMax,
    };
  }
  const reps = summary.repWatts ?? [];
  if (reps.length > 0 && input.hardTarget != null && input.hardTarget > 0) {
    return { kind: 'power', held: reps.filter((w) => w >= input.hardTarget!).length, total: reps.length, target: input.hardTarget };
  }
  return { kind: 'none' };
}

function clock(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export type ZoneCopy = {
  kicker: string;
  /** The big line. */
  headline: string;
  verdict: string;
  body: string;
  /** 0–1 towards the goal, or null when there is nothing to chart. */
  progress: number | null;
  goalLabel: string | null;
  footnote: string | null;
};

/** The words for the after-ride card. Plain, specific, and never more certain than the data. */
export function zoneCopy(result: ZoneResult): ZoneCopy {
  if (result.kind === 'hr') {
    const line = `${result.thresholdBpm} bpm`;
    const maxNote =
      result.maxFrom === 'age'
        ? `90% of ${result.maxHr}, the max heart rate estimated from your age`
        : `90% of ${result.maxHr}, the highest heart rate on your rides`;
    const verdict =
      result.level === 'reached'
        ? 'Goal reached'
        : result.level === 'close'
          ? 'Nearly there'
          : result.level === 'touched'
            ? 'You touched it'
            : 'Not this time';
    const body =
      result.level === 'reached'
        ? `This is what 30/15 is for. You held ${line} or higher long enough to push your aerobic ceiling.`
        : result.level === 'close'
          ? `You got up to ${line} and stayed a while. A little longer up there and the session does its full job.`
          : result.level === 'touched'
            ? `You reached ${line} but didn’t stay there long. The reps should feel like a 9 out of 10 by the end of each set.`
            : `Your heart rate peaked at ${result.peakBpm ?? '—'} bpm, below the ${line} line. If the reps felt comfortable, your HARD target is probably too low.`;
    return {
      kicker: 'TIME NEAR VO₂MAX',
      headline: clock(result.ms),
      verdict,
      body,
      progress: Math.min(1, result.ms / result.goalMs),
      goalLabel: `Goal ${clock(result.goalMs)}`,
      footnote: `Counted as time at ${line} or higher (${maxNote}). Heart rate stands in for oxygen uptake, so this is a guide, not a lab measurement.${result.approx ? ' Estimated per rep for this ride.' : ''}`,
    };
  }
  if (result.kind === 'power') {
    const all = result.held === result.total;
    return {
      kicker: 'DID YOU PUSH?',
      headline: `${result.held} of ${result.total}`,
      verdict: all ? 'Every rep on target' : result.held >= result.total * 0.8 ? 'Most reps on target' : 'Below target on several reps',
      body: `Hard reps at or above your ${result.target} W target. Power shows the work you did; a heart-rate monitor shows whether it took you near VO₂max, which is the point of 30/15.`,
      progress: result.held / result.total,
      goalLabel: null,
      footnote: null,
    };
  }
  return {
    kicker: 'DID YOU REACH THE ZONE?',
    headline: '—',
    verdict: 'No sensor on this ride',
    body: '30/15 works by keeping you near VO₂max for minutes at a time. Connect a heart-rate monitor and every ride will tell you how long you spent there.',
    progress: null,
    goalLabel: null,
    footnote: null,
  };
}
