import type { BuiltWorkout, Segment, WorkoutSettings } from '../types';

function watts(ftp: number, pct: number): number {
  return Math.round((ftp * pct) / 100);
}

/**
 * Build a linear segment timeline for the Rønnestad-style 30/15 session.
 * Warm-up ends with 3× ~10s accelerations and short recoveries.
 */
export function buildWorkout(settings: WorkoutSettings): BuiltWorkout {
  const hardW = watts(settings.ftpWatts, settings.hardPct);
  const easyW = watts(settings.ftpWatts, settings.easyPct);
  const segments: Segment[] = [];
  let n = 0;
  const id = (kind: string) => `${kind}-${n++}`;

  // --- Warm-up: progressive spinning, then 3 accelerations near the end ---
  const warmupTotalMs = settings.warmupMin * 60_000;
  const accelMs = 10_000;
  const accelRecoverMs = 20_000;
  const accelBlockMs = 3 * (accelMs + accelRecoverMs); // 90s
  const preAccelMs = Math.max(60_000, warmupTotalMs - accelBlockMs);

  segments.push({
    id: id('warmup'),
    kind: 'warmup',
    durationMs: preAccelMs,
    label: 'Progressive spin',
    targetWatts: easyW,
    targetHint: 'progressive spin',
  });

  for (let a = 1; a <= 3; a++) {
    segments.push({
      id: id('accel'),
      kind: 'accel',
      durationMs: accelMs,
      label: `Acceleration ${a}/3`,
      targetWatts: hardW,
      targetHint: 'short surge',
    });
    segments.push({
      id: id('warmup-rec'),
      kind: 'warmup',
      durationMs: accelRecoverMs,
      label: a < 3 ? 'Easy between accels' : 'Settle before main',
      targetWatts: easyW,
      targetHint: 'light pressure',
    });
  }

  // --- Main sets ---
  for (let set = 1; set <= settings.sets; set++) {
    for (let rep = 1; rep <= settings.reps; rep++) {
      segments.push({
        id: id('hard'),
        kind: 'hard',
        durationMs: settings.workSec * 1000,
        label: `Hard ${rep}/${settings.reps}`,
        setNumber: set,
        repNumber: rep,
        targetWatts: hardW,
        targetHint: 'above FTP',
      });

      segments.push({
        id: id('easy'),
        kind: 'easy',
        durationMs: settings.recoverSec * 1000,
        label: `Easy ${rep}/${settings.reps}`,
        setNumber: set,
        repNumber: rep,
        targetWatts: easyW,
        targetHint: 'light pressure',
      });
    }

    if (set < settings.sets) {
      segments.push({
        id: id('setrest'),
        kind: 'set_rest',
        durationMs: settings.betweenSetRestMin * 60_000,
        label: `Between sets (${set}→${set + 1})`,
        setNumber: set,
        targetWatts: easyW,
        targetHint: 'easy spinning',
      });
    }
  }

  // --- Cool-down ---
  segments.push({
    id: id('cooldown'),
    kind: 'cooldown',
    durationMs: settings.cooldownMin * 60_000,
    label: 'Easy pedaling',
    targetWatts: easyW,
    targetHint: 'easy pedaling',
  });

  const totalMs = segments.reduce((s, seg) => s + seg.durationMs, 0);
  return { segments, totalMs, hardWatts: hardW, easyWatts: easyW };
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}:${String(rm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function sessionSummary(settings: WorkoutSettings): {
  totalMin: number;
  mainMin: number;
  hardWatts: number;
  easyWatts: number;
} {
  const built = buildWorkout(settings);
  const mainMs =
    settings.sets *
      (settings.reps * (settings.workSec + settings.recoverSec) * 1000) +
    Math.max(0, settings.sets - 1) * settings.betweenSetRestMin * 60_000;
  return {
    totalMin: Math.round(built.totalMs / 60_000),
    mainMin: Math.round(mainMs / 60_000),
    hardWatts: built.hardWatts,
    easyWatts: built.easyWatts,
  };
}
