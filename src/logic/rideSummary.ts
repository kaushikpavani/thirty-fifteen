import type { PhaseKind, RideSummary } from '../types';
import { hrSeconds, parseHrSecs } from './zone';

export const SPARKLINE_MAX = 48;

export type RideSample = {
  atMs: number;
  kind: PhaseKind;
  watts: number | null;
  bpm: number | null;
};

type TimedSegment = {
  kind: string;
  durationMs: number;
  setNumber?: number;
};

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

function peak(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(Math.max(...values));
}

export function timeInKind(segments: TimedSegment[], elapsedMs: number, kind: string): number {
  let cursor = 0;
  let total = 0;
  const end = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  for (const segment of segments) {
    const duration = Math.max(0, segment.durationMs);
    const segEnd = cursor + duration;
    if (segment.kind === kind) {
      const overlap = Math.min(segEnd, end) - cursor;
      if (overlap > 0) total += overlap;
    }
    cursor = segEnd;
    if (cursor >= end) break;
  }
  return total;
}

/** A set counts when its last hard/easy interval has ended. */
export function setsFinished(segments: TimedSegment[], elapsedMs: number, planned: number): number {
  const ends = new Map<number, number>();
  let cursor = 0;
  const endAt = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  for (const segment of segments) {
    const segEnd = cursor + Math.max(0, segment.durationMs);
    if ((segment.kind === 'hard' || segment.kind === 'easy') && segment.setNumber) {
      ends.set(segment.setNumber, segEnd);
    }
    cursor = segEnd;
  }
  let done = 0;
  const cap = Math.max(0, Math.round(planned));
  for (let set = 1; set <= cap; set++) {
    const end = ends.get(set);
    if (end != null && endAt + 20 >= end) done += 1;
  }
  return done;
}

export function downsample(values: number[], max: number): number[] {
  if (values.length <= max) return values.slice();
  if (max <= 1) return values.length ? [values[values.length - 1]!] : [];
  const out: number[] = [];
  const step = (values.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    out.push(values[Math.round(i * step)] ?? 0);
  }
  return out;
}

function workKj(samples: RideSample[]): number | null {
  const points = samples
    .filter((sample) => finite(sample.watts) && finite(sample.atMs))
    .slice()
    .sort((a, b) => a.atMs - b.atMs);
  if (points.length === 0) return null;
  if (points.length === 1) return Math.round((points[0]!.watts! * 1) / 1000);
  let joules = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    const dt = Math.max(0, next.atMs - prev.atMs) / 1000;
    joules += ((prev.watts! + next.watts!) / 2) * dt;
  }
  return Math.round(joules / 1000);
}

function valuesFor(samples: RideSample[], kind: string | null, pick: (sample: RideSample) => number | null): number[] {
  const out: number[] = [];
  for (const sample of samples) {
    if (kind && sample.kind !== kind) continue;
    const value = pick(sample);
    if (finite(value)) out.push(value);
  }
  return out;
}

export const REP_WATTS_MAX = 60;

/** Mean watts inside each HARD segment's window. Reps without samples are left out. */
export function repWatts(segments: TimedSegment[], samples: RideSample[]): number[] {
  const out: number[] = [];
  let cursor = 0;
  for (const segment of segments) {
    const start = cursor;
    const end = cursor + Math.max(0, segment.durationMs);
    cursor = end;
    if (segment.kind !== 'hard') continue;
    const inside: number[] = [];
    for (const sample of samples) {
      if (sample.atMs >= start && sample.atMs < end && finite(sample.watts)) inside.push(sample.watts);
    }
    const avg = mean(inside);
    if (avg != null) out.push(avg);
    if (out.length >= REP_WATTS_MAX) break;
  }
  return out;
}

/** Mean bpm inside each HARD segment's window. Mirrors repWatts. */
export function repBpm(segments: TimedSegment[], samples: RideSample[]): number[] {
  const out: number[] = [];
  let cursor = 0;
  for (const segment of segments) {
    const start = cursor;
    const end = cursor + Math.max(0, segment.durationMs);
    cursor = end;
    if (segment.kind !== 'hard') continue;
    const inside: number[] = [];
    for (const sample of samples) {
      if (sample.atMs >= start && sample.atMs < end && finite(sample.bpm)) inside.push(sample.bpm);
    }
    const avg = mean(inside);
    if (avg != null) out.push(avg);
    if (out.length >= REP_WATTS_MAX) break;
  }
  return out;
}

/**
 * Watts per heartbeat during hard efforts — TrainingPeaks calls this
 * Efficiency Factor. Higher means more power for the same cardiac cost, the
 * classic sign of a fitter aerobic engine. Null without both sensors.
 */
export function efficiencyFactor(avgHardWatts: number | null, avgHardBpm: number | null): number | null {
  if (avgHardWatts == null || avgHardBpm == null || avgHardBpm <= 0) return null;
  return Math.round((avgHardWatts / avgHardBpm) * 10) / 10;
}

/**
 * Pw:Hr decoupling, adapted to intervals: split the hard reps in half and
 * compare each half's efficiency factor. A big positive number means the
 * heart worked harder for the same watts as the ride went on (fatigue, heat,
 * under-fueling); under ~5% is the usual mark of a well-paced aerobic effort.
 * Needs at least 4 reps with both watts and bpm to split meaningfully.
 */
export function decouplingPct(repW: number[], repB: number[]): number | null {
  const n = Math.min(repW.length, repB.length);
  if (n < 4) return null;
  const half = Math.floor(n / 2);
  const ef = (ws: number[], bs: number[]) => {
    const w = mean(ws);
    const b = mean(bs);
    return w != null && b != null && b > 0 ? w / b : null;
  };
  const first = ef(repW.slice(0, half), repB.slice(0, half));
  const second = ef(repW.slice(n - half), repB.slice(n - half));
  if (first == null || second == null || first === 0) return null;
  return Math.round(((first - second) / first) * 1000) / 10;
}

export function summarizeRide(input: {
  segments: TimedSegment[];
  elapsedMs: number;
  plannedSets: number;
  completed: boolean;
  samples: RideSample[];
  /** Time actually spent riding; the playhead (`elapsedMs`) still decides sets and rep stats. */
  activeMs?: number;
}): RideSummary {
  const elapsed = Number.isFinite(input.elapsedMs) ? Math.max(0, input.elapsedMs) : 0;
  const planned = Math.max(0, Math.round(input.plannedSets));
  const watts = valuesFor(input.samples, null, (sample) => sample.watts);
  const hardWatts = valuesFor(input.samples, 'hard', (sample) => sample.watts);
  const easyWatts = valuesFor(input.samples, 'easy', (sample) => sample.watts);
  const bpm = valuesFor(input.samples, null, (sample) => sample.bpm);
  const hardBpm = valuesFor(input.samples, 'hard', (sample) => sample.bpm);
  const easyBpm = valuesFor(input.samples, 'easy', (sample) => sample.bpm);
  const done = input.completed ? planned : setsFinished(input.segments, elapsed, planned);
  const avgHardWatts = mean(hardWatts);
  const avgHardBpm = mean(hardBpm);
  const perRepWatts = repWatts(input.segments, input.samples);
  const perRepBpm = repBpm(input.segments, input.samples);
  const hrSecs = hrSeconds(input.samples);
  return {
    ...(hrSecs ? { hrSecs } : {}),
    setsDone: done,
    setsPlanned: planned,
    durationMs: input.activeMs != null && Number.isFinite(input.activeMs) ? Math.max(0, input.activeMs) : elapsed,
    hardMs: timeInKind(input.segments, elapsed, 'hard'),
    easyMs: timeInKind(input.segments, elapsed, 'easy'),
    avgWatts: mean(watts),
    peakWatts: peak(watts),
    avgHardWatts,
    avgEasyWatts: mean(easyWatts),
    workKj: workKj(input.samples),
    sparkline: downsample(watts, SPARKLINE_MAX),
    avgBpm: mean(bpm),
    maxBpm: peak(bpm),
    avgHardBpm,
    avgEasyBpm: mean(easyBpm),
    repWatts: perRepWatts,
    repBpm: perRepBpm,
    efficiencyFactor: efficiencyFactor(avgHardWatts, avgHardBpm),
    decouplingPct: decouplingPct(perRepWatts, perRepBpm),
  };
}

export type InsightStat = { label: string; value: string; unit: string; explain: string };

/**
 * The metrics that need both a power meter and a heart-rate strap to mean
 * anything. Kept separate from doneStats() (in DoneSummary) because these
 * are the ones worth a plain-language footnote — nobody needs "average
 * heart rate" explained to them.
 */
export function insightStats(summary: RideSummary): InsightStat[] {
  const out: InsightStat[] = [];
  if (summary.efficiencyFactor != null) {
    out.push({
      label: 'Efficiency factor',
      value: summary.efficiencyFactor.toFixed(1),
      unit: 'W/bpm',
      explain:
        'Your hard-effort watts divided by your hard-effort heart rate — how much power you produced per heartbeat. Higher is better, and it climbs over weeks of training even at the same FTP: the clearest sign your aerobic engine is getting fitter.',
    });
  }
  if (summary.decouplingPct != null) {
    const sign = summary.decouplingPct > 0 ? '+' : '';
    out.push({
      label: 'HR:Power drift',
      value: `${sign}${summary.decouplingPct.toFixed(1)}`,
      unit: '%',
      explain:
        "How much your watts-per-heartbeat fell from your first hard reps to your last. Under about 5% usually means you paced the ride well; a bigger number often means fatigue, heat, or under-fueling caught up with you before the finish.",
    });
  }
  return out;
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.round(value);
}

/** Like nullableNumber, but keeps one decimal — efficiencyFactor and decouplingPct are not whole numbers. */
function nullableDecimal(value: unknown): number | null | undefined {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.round(value * 10) / 10;
}

export function parseStoredSummary(raw: unknown): RideSummary | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Partial<RideSummary>;
  const setsDone = nullableNumber(row.setsDone);
  const setsPlanned = nullableNumber(row.setsPlanned);
  const durationMs = nullableNumber(row.durationMs);
  const hardMs = nullableNumber(row.hardMs);
  const easyMs = nullableNumber(row.easyMs);
  if (
    setsDone == null ||
    setsPlanned == null ||
    durationMs == null ||
    hardMs == null ||
    easyMs == null
  ) {
    return undefined;
  }
  const avgWatts = nullableNumber(row.avgWatts);
  const peakWatts = nullableNumber(row.peakWatts);
  const avgHardWatts = nullableNumber(row.avgHardWatts);
  const avgEasyWatts = nullableNumber(row.avgEasyWatts);
  const workKj = nullableNumber(row.workKj);
  const avgBpm = nullableNumber(row.avgBpm);
  const maxBpm = nullableNumber(row.maxBpm);
  const avgHardBpm = nullableNumber(row.avgHardBpm);
  const avgEasyBpm = nullableNumber(row.avgEasyBpm);
  if (
    avgWatts === undefined ||
    peakWatts === undefined ||
    avgHardWatts === undefined ||
    avgEasyWatts === undefined ||
    workKj === undefined ||
    avgBpm === undefined ||
    maxBpm === undefined ||
    avgHardBpm === undefined ||
    avgEasyBpm === undefined
  ) {
    return undefined;
  }
  const sparkline = Array.isArray(row.sparkline)
    ? row.sparkline.filter((point): point is number => typeof point === 'number' && Number.isFinite(point)).slice(0, SPARKLINE_MAX)
    : [];
  const reps = Array.isArray(row.repWatts)
    ? row.repWatts.filter((point): point is number => typeof point === 'number' && Number.isFinite(point)).slice(0, REP_WATTS_MAX)
    : [];
  // Added after the first shipped version — a ride saved before this existed
  // just has no bpm-per-rep or derived-metric fields, which is fine: treat
  // that as "none of this data", not as a reason to drop the whole summary.
  const repsBpm = Array.isArray(row.repBpm)
    ? row.repBpm.filter((point): point is number => typeof point === 'number' && Number.isFinite(point)).slice(0, REP_WATTS_MAX)
    : [];
  const ef = nullableDecimal(row.efficiencyFactor);
  const decoupling = nullableDecimal(row.decouplingPct);
  const hrSecs = parseHrSecs(row.hrSecs);
  return {
    ...(hrSecs ? { hrSecs } : {}),
    setsDone,
    setsPlanned,
    durationMs,
    hardMs,
    easyMs,
    avgWatts,
    peakWatts,
    avgHardWatts,
    avgEasyWatts,
    workKj,
    sparkline,
    avgBpm,
    maxBpm,
    avgHardBpm,
    avgEasyBpm,
    repWatts: reps,
    repBpm: repsBpm,
    efficiencyFactor: ef ?? null,
    decouplingPct: decoupling ?? null,
  };
}
