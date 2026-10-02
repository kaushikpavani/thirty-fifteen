/**
 * Progress over time, computed from the rides on this phone (which, for a
 * signed-in rider, includes everything synced from the cloud).
 *
 * Shaped after how training apps show history: per-workout values are
 * noisy, so trends are a rolling average over dots (TrainingPeaks,
 * intervals.icu); headlines compare this period with the one before
 * (Strava, Garmin); volume is weekly bars with a streak (Strava); and
 * personal records call out bests (Strava, TrainerRoad).
 */
import type { WorkoutRecord } from '../types';
import { zoneResult } from './zone';

export type MetricId = 'zone' | 'hardWatts' | 'efficiency' | 'drift' | 'ftp' | 'hardBpm';

/** What a metric may need to know about the rider, beyond the ride itself. */
export type TrendContext = { observedMaxBpm: number | null; ageYears: number | null };
const NO_CONTEXT: TrendContext = { observedMaxBpm: null, ageYears: null };

/** Minutes at or above 90% of max heart rate on a ride, the same number the after-ride card shows. */
export function zoneMinutes(ride: WorkoutRecord, ctx: TrendContext = NO_CONTEXT): number | null {
  if (!ride.summary) return null;
  const result = zoneResult({ summary: ride.summary, observedMaxBpm: ctx.observedMaxBpm, ageYears: ctx.ageYears, hardTarget: null });
  return result.kind === 'hr' ? result.ms / 60_000 : null;
}

export type Metric = {
  id: MetricId;
  label: string;
  unit: string;
  decimals: number;
  /** Which way is better. Drives delta colour and arrow wording. */
  better: 'up' | 'down';
  /** What it means, in one or two plain sentences. */
  explain: string;
  /** What the rider needs connected for this metric to exist. */
  needs: string;
  value: (ride: WorkoutRecord, ctx?: TrendContext) => number | null;
};

const finite = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const METRICS: Record<MetricId, Metric> = {
  zone: {
    id: 'zone',
    label: 'Time near VO₂max',
    unit: 'min',
    decimals: 1,
    better: 'up',
    explain: 'Minutes per ride with your heart rate at 90% of max or higher. This is what 30/15 is built to give you, so it is the clearest sign a session did its job. A guide from heart rate, not a lab measurement.',
    needs: 'a heart-rate monitor',
    value: (r, ctx) => zoneMinutes(r, ctx),
  },
  hardWatts: {
    id: 'hardWatts',
    label: 'Hard-rep power',
    unit: 'W',
    decimals: 0,
    better: 'up',
    explain: 'Average watts across your 30-second HARD reps. The most direct measure of what 30/15 trains: holding high power near VO₂max, rep after rep.',
    needs: 'a power meter',
    value: (r) => finite(r.summary?.avgHardWatts),
  },
  efficiency: {
    id: 'efficiency',
    label: 'Efficiency factor',
    unit: 'W/bpm',
    decimals: 2,
    better: 'up',
    explain: 'Hard-rep watts per heartbeat. Rising means more power for the same cardiac cost — your aerobic engine getting fitter, even before FTP moves.',
    needs: 'a power meter and a heart-rate strap',
    value: (r) => finite(r.summary?.efficiencyFactor),
  },
  drift: {
    id: 'drift',
    label: 'HR:Power drift',
    unit: '%',
    decimals: 1,
    better: 'down',
    explain: 'How much watts-per-heartbeat faded from your first reps to your last. Lower is better: it means you held quality to the end of the session.',
    needs: 'a power meter and a heart-rate strap',
    value: (r) => finite(r.summary?.decouplingPct),
  },
  ftp: {
    id: 'ftp',
    label: 'FTP',
    unit: 'W',
    decimals: 0,
    better: 'up',
    explain: 'The FTP each ride was set up with. Every target in a 30/15 session scales from it, so steps up here are your training moving up a gear.',
    needs: 'nothing — every ride records it',
    value: (r) => finite(r.ftpWatts),
  },
  hardBpm: {
    id: 'hardBpm',
    label: 'Hard-rep heart rate',
    unit: 'bpm',
    decimals: 0,
    better: 'up',
    explain: 'Average heart rate during HARD reps. For VO₂max work, reaching a high heart rate is the goal; read it next to power to see the whole picture.',
    needs: 'a heart-rate strap',
    value: (r) => finite(r.summary?.avgHardBpm),
  },
};

export type Point = { t: number; value: number; rideId: string };

/** One point per ride that has this metric, oldest first. */
export function metricPoints(rides: readonly WorkoutRecord[], metric: Metric, ctx?: TrendContext): Point[] {
  const out: Point[] = [];
  for (const ride of rides) {
    const value = metric.value(ride, ctx);
    const t = Date.parse(ride.endedAt);
    if (value != null && Number.isFinite(t)) out.push({ t, value, rideId: ride.id });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Trailing mean over the last `window` points, so the line starts at the first ride. */
export function rollingMean(points: readonly Point[], window: number): Point[] {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1);
    return { ...p, value: slice.reduce((s, q) => s + q.value, 0) / slice.length };
  });
}

export type Period = '4w' | '3m' | '1y' | 'all';
export const PERIODS: { id: Period; label: string; days: number | null; prior: string }[] = [
  { id: '4w', label: '4W', days: 28, prior: 'prior 4 weeks' },
  { id: '3m', label: '3M', days: 91, prior: 'prior 3 months' },
  { id: '1y', label: '1Y', days: 365, prior: 'prior year' },
  { id: 'all', label: 'All', days: null, prior: 'first rides' },
];

const DAY = 86_400_000;

export function inPeriod<T extends { t: number }>(points: readonly T[], period: Period, now: number): T[] {
  const days = PERIODS.find((p) => p.id === period)!.days;
  if (days == null) return points.slice();
  return points.filter((p) => p.t > now - days * DAY && p.t <= now);
}

export type Delta = {
  current: number;
  previous: number | null;
  /** Signed change, current − previous. */
  change: number | null;
  pct: number | null;
  good: boolean | null;
};

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * Mean in the period, against the equal-length period just before it.
 * For "All", compares the most recent third of rides against the first third.
 */
export function periodDelta(points: readonly Point[], metric: Metric, period: Period, now: number): Delta | null {
  const days = PERIODS.find((p) => p.id === period)!.days;
  let current: number[];
  let previous: number[];
  if (days == null) {
    if (points.length === 0) return null;
    const third = Math.max(1, Math.floor(points.length / 3));
    current = points.slice(-third).map((p) => p.value);
    previous = points.length >= 2 ? points.slice(0, third).map((p) => p.value) : [];
  } else {
    const start = now - days * DAY;
    current = points.filter((p) => p.t > start && p.t <= now).map((p) => p.value);
    previous = points.filter((p) => p.t > start - days * DAY && p.t <= start).map((p) => p.value);
  }
  if (current.length === 0) return null;
  const cur = mean(current);
  if (previous.length === 0) return { current: cur, previous: null, change: null, pct: null, good: null };
  const prev = mean(previous);
  const change = cur - prev;
  const pct = prev !== 0 ? (change / Math.abs(prev)) * 100 : null;
  // Changes under half a percent are "about the same", not a win or a loss.
  const flat = pct != null ? Math.abs(pct) < 0.5 : change === 0;
  const good = flat ? null : metric.better === 'up' ? change > 0 : change < 0;
  return { current: cur, previous: prev, change, pct, good };
}

/** Monday 00:00 local of the week containing t. */
export function weekStart(t: number): number {
  const d = new Date(t);
  const day = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
}

export type Week = { start: number; rides: number; hardMinutes: number; workKj: number };

/** The last `count` weeks, oldest first, including empty ones. */
export function weeklyVolume(rides: readonly WorkoutRecord[], count: number, now: number): Week[] {
  const thisWeek = weekStart(now);
  const weeks: Week[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(thisWeek);
    weeks.push({ start: new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7 * i).getTime(), rides: 0, hardMinutes: 0, workKj: 0 });
  }
  const index = new Map(weeks.map((w, i) => [w.start, i]));
  for (const ride of rides) {
    const i = index.get(weekStart(Date.parse(ride.endedAt)));
    if (i == null) continue;
    const w = weeks[i]!;
    w.rides += 1;
    w.hardMinutes += (ride.summary?.hardMs ?? 0) / 60_000;
    w.workKj += ride.summary?.workKj ?? 0;
  }
  return weeks;
}

/**
 * Consecutive weeks with at least one ride, counting back from this week.
 * This week doesn't break the streak just because it isn't over yet.
 */
export function weekStreak(rides: readonly WorkoutRecord[], now: number): number {
  const weeks = new Set(rides.map((r) => weekStart(Date.parse(r.endedAt))));
  let cursor = weekStart(now);
  if (!weeks.has(cursor)) {
    const d = new Date(cursor);
    cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7).getTime();
  }
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    const d = new Date(cursor);
    cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7).getTime();
  }
  return streak;
}

export type Record_ = { id: string; label: string; value: string; unit: string; rideId: string; at: string };

/** Personal bests across all rides. Only records the rider's data supports. */
export function personalRecords(rides: readonly WorkoutRecord[], ctx?: TrendContext): Record_[] {
  const out: Record_[] = [];
  const best = (label: string, unit: string, decimals: number, pick: (r: WorkoutRecord) => number | null) => {
    let top: { v: number; r: WorkoutRecord } | null = null;
    for (const r of rides) {
      const v = pick(r);
      if (v != null && Number.isFinite(v) && (!top || v > top.v)) top = { v, r };
    }
    if (top) out.push({ id: label, label, value: top.v.toFixed(decimals), unit, rideId: top.r.id, at: top.r.endedAt });
  };
  best('Most time near VO₂max', 'min', 1, (r) => {
    const minutes = zoneMinutes(r, ctx);
    return minutes != null && minutes > 0 ? minutes : null;
  });
  best('Best single 30-second rep', 'W', 0, (r) => (r.summary?.repWatts?.length ? Math.max(...r.summary.repWatts) : null));
  best('Best hard-rep average', 'W', 0, (r) => finite(r.summary?.avgHardWatts));
  best('Best efficiency factor', 'W/bpm', 2, (r) => finite(r.summary?.efficiencyFactor));
  best('Most time in HARD', 'min', 1, (r) => (r.summary?.hardMs ? r.summary.hardMs / 60_000 : null));
  best('Most work in one ride', 'kJ', 0, (r) => finite(r.summary?.workKj));
  return out;
}

/** "▲ 6% vs prior 4 weeks" — direction in words and arrow, never colour alone. */
export function deltaText(delta: Delta | null, metric: Metric, prior: string | null): string | null {
  if (!delta || delta.change == null) return null;
  const arrow = delta.good == null ? '●' : delta.change > 0 ? '▲' : '▼';
  if (delta.good == null) return prior ? `${arrow} About the same as ${prior}` : `${arrow} Steady`;
  const amount =
    delta.pct != null && metric.unit !== '%'
      ? `${Math.abs(delta.pct).toFixed(Math.abs(delta.pct) < 10 ? 1 : 0)}%`
      : `${Math.abs(delta.change).toFixed(metric.decimals)} ${metric.unit === '%' ? 'pts' : metric.unit}`;
  return prior ? `${arrow} ${amount} vs ${prior}` : `${arrow} ${amount}`;
}
