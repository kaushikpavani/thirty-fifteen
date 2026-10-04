/**
 * Power coaching: when a power meter is connected and the rider's watts stay
 * below the hard target, the coach says a few words to push them.
 *
 * Rules, all from the meter only (no meter, no nudges; the ride keeps its
 * normal cues and music):
 *  - only during a HARD rep, after the first 7 s of it (the ramp-up) and
 *    after the encouragement line that already plays at 10-12 s, and never in
 *    the last 4 s;
 *  - "consistently": at least 5 fresh readings in the last 6 s, 80% of them
 *    under target, and the average at least 8 W (and 6%) under;
 *  - at most one nudge per rep, one a minute, and eight a ride, so it never
 *    nags;
 *  - say how far under in tens of watts ("twenty watts under"), or just push
 *    when it is a long way;
 *  - once, if they then get back on target in the same rep, say so.
 */

export const SETTLE_MS = 7000;
export const WINDOW_MS = 6000;
export const NUDGE_FROM_MS = 13_000;
export const END_GUARD_MS = 4000;
export const MIN_SAMPLES = 5;
export const MIN_GAP_W = 8;
export const MIN_GAP_PCT = 0.06;
export const SHARE_BELOW = 0.8;
export const MIN_SPACING_MS = 60_000;
export const MAX_PER_RIDE = 8;
const MAX_SANE_WATTS = 3000;

export type PowerNudge = { type: 'under' | 'back'; clip: string; line: string; gapW: number };

/** The clips this feature speaks, with their words. Mirrors assets/voice/script.en.json. */
export const POWER_LINES: Record<string, string> = {
  powerUnder10: 'About ten watts under target. Push a little.',
  powerUnder20: 'About twenty watts under. Pick it up, let’s go.',
  powerUnder30: 'About thirty watts under. Dig in, we need that goal.',
  powerClose1: 'Almost there. A little more power.',
  powerClose2: 'Just under target. Push a bit harder.',
  powerFar1: 'You’re well under target. Dig in, you’ve got this.',
  powerFar2: 'Let’s go. We need to hit the goal. Pick it up.',
  powerFar3: 'Power’s dropping. Bring it back up.',
  powerBack1: 'There it is. Hold that.',
  powerBack2: 'Yes. That’s the target. Stay there.',
};

/** Which clips fit a gap, most specific first. */
export function poolFor(gapW: number): string[] {
  const tens = Math.max(1, Math.round(gapW / 10));
  if (tens === 1) return ['powerUnder10', 'powerClose1', 'powerClose2'];
  if (tens === 2) return ['powerUnder20', 'powerFar2', 'powerFar3'];
  if (tens === 3) return ['powerUnder30', 'powerFar1', 'powerFar2'];
  return ['powerFar1', 'powerFar2', 'powerFar3'];
}

export type PowerTick = {
  /** Clock time of the ride, ms. */
  rideMs: number;
  kind: string;
  /** Identifies this rep (same value for every tick of one rep). */
  repKey: string;
  repElapsedMs: number;
  repRemainingMs: number;
  /** Fresh reading from a connected meter, or null (no meter, dropped out, stale). */
  watts: number | null;
  target: number;
};

type Reading = { at: number; watts: number | null };

export function createPowerCoach() {
  let repKey: string | null = null;
  let readings: Reading[] = [];
  let lastNudgeAt: number | null = null;
  let nudges = 0;
  let nudgedRep: string | null = null;
  let backSaidRep: string | null = null;
  let picks = 0;

  function reset(): void {
    repKey = null;
    readings = [];
    lastNudgeAt = null;
    nudges = 0;
    nudgedRep = null;
    backSaidRep = null;
    picks = 0;
  }

  function tick(t: PowerTick): PowerNudge | null {
    if (t.kind !== 'hard') {
      repKey = null;
      readings = [];
      return null;
    }
    if (t.repKey !== repKey) {
      repKey = t.repKey;
      readings = [];
    }
    const sane = typeof t.watts === 'number' && Number.isFinite(t.watts) && t.watts >= 0 && t.watts <= MAX_SANE_WATTS;
    readings.push({ at: t.repElapsedMs, watts: sane ? (t.watts as number) : null });
    readings = readings.filter((r) => r.at > t.repElapsedMs - WINDOW_MS && r.at >= SETTLE_MS);

    if (!Number.isFinite(t.target) || t.target <= 0) return null;
    if (t.repElapsedMs < NUDGE_FROM_MS || t.repRemainingMs < END_GUARD_MS) return null;
    const fresh = readings.filter((r): r is { at: number; watts: number } => r.watts != null);
    if (fresh.length < MIN_SAMPLES) return null;
    const avg = fresh.reduce((sum, r) => sum + r.watts, 0) / fresh.length;
    const gap = t.target - avg;
    const spaced = lastNudgeAt == null || t.rideMs - lastNudgeAt >= MIN_SPACING_MS;

    // Back on target after a nudge in this very rep: say so once.
    if (nudgedRep === t.repKey && backSaidRep !== t.repKey && avg >= t.target * 0.98 && t.rideMs - (lastNudgeAt ?? 0) >= 8000) {
      backSaidRep = t.repKey;
      return { type: 'back', clip: backClip(), line: POWER_LINES[backClip()]!, gapW: 0 };
    }

    if (nudgedRep === t.repKey || !spaced || nudges >= MAX_PER_RIDE) return null;
    const below = fresh.filter((r) => r.watts < t.target * 0.97).length / fresh.length;
    if (below < SHARE_BELOW || gap < Math.max(MIN_GAP_W, t.target * MIN_GAP_PCT)) return null;

    const pool = poolFor(gap);
    const clip = pool[picks % pool.length]!;
    picks += 1;
    nudges += 1;
    nudgedRep = t.repKey;
    lastNudgeAt = t.rideMs;
    return { type: 'under', clip, line: POWER_LINES[clip]!, gapW: Math.round(gap) };
  }

  function backClip(): string {
    return picks % 2 === 0 ? 'powerBack1' : 'powerBack2';
  }

  return { tick, reset };
}
