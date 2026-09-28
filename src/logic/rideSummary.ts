import type { PhaseKind, RideSummary } from '../types';

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

export function summarizeRide(input: {
  segments: TimedSegment[];
  elapsedMs: number;
  plannedSets: number;
  completed: boolean;
  samples: RideSample[];
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
  return {
    setsDone: done,
    setsPlanned: planned,
    durationMs: elapsed,
    hardMs: timeInKind(input.segments, elapsed, 'hard'),
    easyMs: timeInKind(input.segments, elapsed, 'easy'),
    avgWatts: mean(watts),
    peakWatts: peak(watts),
    avgHardWatts: mean(hardWatts),
    avgEasyWatts: mean(easyWatts),
    workKj: workKj(input.samples),
    sparkline: downsample(watts, SPARKLINE_MAX),
    avgBpm: mean(bpm),
    maxBpm: peak(bpm),
    avgHardBpm: mean(hardBpm),
    avgEasyBpm: mean(easyBpm),
  };
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.round(value);
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
  return {
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
  };
}
