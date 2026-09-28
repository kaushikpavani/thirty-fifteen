/**
 * What the ride screen shows for one instant. Pure, so it is testable
 * without a phone. The screen only draws what this returns.
 */
import type { PhaseKind } from '../types';

export type ViewSegment = {
  kind: PhaseKind;
  durationMs: number;
  label: string;
  setNumber?: number;
  repNumber?: number;
};

export type RideView = {
  phase: string;
  /** Right side of the header: "7 of 13", "Set 2 next", "Acceleration 2/3". */
  context: string;
  /** Left caption under the rail. */
  caption: string;
  /** Right caption under the rail: time left in the whole ride. */
  toGo: string;
  rail: { kind: 'reps'; count: number; done: number; progress: number } | { kind: 'bar'; progress: number };
  /** Pill under the watts. */
  cue: { text: string; target: boolean };
  /** Watts to hit right now (the next HARD during a count-in), or null. */
  target: number | null;
  clock: string;
  /** Seconds (3, 2, 1) when HARD is about to begin, else null. */
  countIn: number | null;
  /** 0..1 through the count-in window. */
  rise: number | null;
  /** 0..1 through this segment, for the falling shade. */
  progress: number;
};

export const COUNT_IN_MS = 3000;

export function clockText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function phaseWord(kind: PhaseKind): string {
  switch (kind) {
    case 'hard':
      return 'HARD';
    case 'easy':
      return 'EASY';
    case 'accel':
      return 'SURGE';
    case 'set_rest':
      return 'SET REST';
    case 'cooldown':
    case 'done':
      return 'COOL-DOWN';
    default:
      return 'WARM-UP';
  }
}

export function rideView(input: {
  segments: ViewSegment[];
  index: number;
  remainingMs: number;
  elapsedMs: number;
  totalMs: number;
  sets: number;
  reps: number;
  workMs: number;
  recoverMs: number;
  hardWatts: number;
  easyWatts: number;
}): RideView {
  const seg = input.segments[input.index];
  const next = input.segments[input.index + 1] ?? null;
  const kind: PhaseKind = seg?.kind ?? 'warmup';
  const duration = Math.max(1, seg?.durationMs ?? 1);
  const remaining = Math.max(0, input.remainingMs);
  const elapsedIn = Math.max(0, duration - remaining);
  const progress = Math.min(1, elapsedIn / duration);
  const toGo = `${clockText(Math.max(0, input.totalMs - input.elapsedMs))} to go`;
  const reps = Math.max(1, input.reps);

  const countingIn = next?.kind === 'hard' && kind !== 'hard' && remaining > 0 && remaining <= COUNT_IN_MS;
  const countIn = countingIn ? Math.max(1, Math.ceil(remaining / 1000)) : null;
  const rise = countingIn ? Math.min(1, (COUNT_IN_MS - remaining) / COUNT_IN_MS) : null;

  let context = '';
  let caption = '';
  let rail: RideView['rail'] = { kind: 'bar', progress };
  let cue: RideView['cue'] = { text: 'Build gently', target: false };

  if (kind === 'hard' || kind === 'easy') {
    const rep = Math.max(1, Math.min(reps, seg?.repNumber ?? 1));
    context = `${rep} of ${reps}`;
    caption = `Set ${seg?.setNumber ?? 1} of ${input.sets}`;
    const cycle = Math.max(1, input.workMs + input.recoverMs);
    const into = kind === 'hard' ? elapsedIn : input.workMs + elapsedIn;
    rail = { kind: 'reps', count: reps, done: rep - 1, progress: Math.min(1, into / cycle) };
    cue = kind === 'hard' ? { text: `Target ${input.hardWatts}`, target: true } : { text: `Easy ${input.easyWatts}`, target: true };
  } else if (kind === 'set_rest') {
    const set = seg?.setNumber ?? 1;
    context = `Set ${set + 1} next`;
    caption = `Set ${set} complete`;
    rail = { kind: 'reps', count: reps, done: reps, progress: 0 };
    cue = { text: 'Spin easy. Drink.', target: false };
  } else if (kind === 'cooldown' || kind === 'done') {
    context = 'Easy spin';
    caption = 'Cool-down';
    cue = { text: 'Spin it out', target: false };
  } else {
    // warm-up and its accelerations: one bar across the whole warm-up
    let start = 0;
    let end = 0;
    let acc = 0;
    let firstAccel: number | null = null;
    for (let i = 0; i < input.segments.length; i++) {
      const s = input.segments[i]!;
      const isWarm = s.kind === 'warmup' || s.kind === 'accel';
      if (i === 0 && !isWarm) break;
      if (!isWarm) break;
      if (s.kind === 'accel' && firstAccel == null) firstAccel = acc;
      acc += s.durationMs;
      end = acc;
    }
    start = 0;
    const warmElapsed = Math.max(0, Math.min(end, input.elapsedMs) - start);
    rail = { kind: 'bar', progress: end > 0 ? warmElapsed / end : progress };
    context = kind === 'accel' ? seg?.label ?? 'Surge' : 'Progressive spin';
    caption =
      firstAccel != null && input.elapsedMs < firstAccel
        ? `Surges in ${clockText(firstAccel - input.elapsedMs)}`
        : `Main set in ${clockText(end - input.elapsedMs)}`;
    cue = kind === 'accel' ? { text: 'Short surge', target: false } : { text: 'Build gently', target: false };
  }

  if (countingIn) cue = { text: `Next ${input.hardWatts}`, target: true };
  const target = countingIn || kind === 'hard' || kind === 'accel' ? input.hardWatts : kind === 'easy' ? input.easyWatts : null;

  return {
    phase: phaseWord(kind),
    context,
    caption,
    toGo,
    rail,
    cue,
    target,
    clock: clockText(remaining),
    countIn,
    rise,
    progress,
  };
}

/** The upcoming HARD's rep number, for "HARD 8 IN". */
export function nextHardRep(segments: ViewSegment[], index: number): number | null {
  const next = segments[index + 1];
  return next?.kind === 'hard' ? next.repNumber ?? null : null;
}
