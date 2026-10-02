/**
 * VO2max estimate — a Firstbeat-style field estimate built from data the app
 * already has (FTP, ride heart-rate) plus a few numbers the rider enters
 * once (age, sex, weight, resting heart rate). This is NOT the Firstbeat
 * algorithm itself (that's Garmin's proprietary, licensed IP, folded into
 * Garmin's own products since their 2020 acquisition) — it's our own
 * estimate built from the same *kind* of inputs (effort heart rate relative
 * to resting/max heart rate, power relative to bodyweight), using published,
 * non-proprietary formulas. Good for tracking a trend over weeks; not a lab
 * test.
 *
 * Sources (checked, not from memory):
 * - ACSM leg-ergometer VO2 equation, applied to FTP via the common
 *   FTP ≈ 0.75 × MAP assumption: field estimates from this run ~5–12% off a
 *   lab value (https://roadmancycling.com/blog/vo2max-cycling-what-your-number-means-guide).
 * - Uth–Sørensen–Overgaard–Pedersen non-exercise estimate,
 *   VO2max ≈ 15.3 × (HRmax / HRrest) — a simple, published HR-ratio formula.
 * - FRIEND registry percentiles (Mayo Clin Proc 2022; see data/vo2Norms),
 *   used only to place a value among the rider's age and sex, not to compute it.
 */

import { standing, type StandingLevel } from './vo2Standing';

const LB_PER_KG = 0.45359237;

export function lbToKg(lb: number): number {
  return lb * LB_PER_KG;
}

/** Tanaka et al. age-predicted max heart rate — a better fit than 220-age. */
export function estimateMaxHr(ageYears: number): number {
  return Math.round(208 - 0.7 * ageYears);
}

/**
 * ACSM cycling oxygen-cost equation, worked backward from FTP.
 * MAP (maximal aerobic power) ≈ FTP / 0.75; VO2max = (10.8 × MAP / kg) + 7.
 * Returns null without a usable FTP or weight.
 */
export function vo2FromPower(ftpWatts: number, weightLb: number): number | null {
  if (!Number.isFinite(ftpWatts) || ftpWatts <= 0) return null;
  if (!Number.isFinite(weightLb) || weightLb <= 0) return null;
  const kg = lbToKg(weightLb);
  const map = ftpWatts / 0.75;
  return (10.8 * map) / kg + 7;
}

/** Uth–Sørensen–Overgaard–Pedersen non-exercise HR-ratio estimate. */
export function vo2FromHr(restingHr: number, maxHr: number): number | null {
  if (!Number.isFinite(restingHr) || restingHr <= 0) return null;
  if (!Number.isFinite(maxHr) || maxHr <= 0) return null;
  return 15.3 * (maxHr / restingHr);
}

export type Vo2Source = 'power' | 'hr' | 'blended';

/** What actually went into an estimate, so the screen can say so plainly. */
export type Vo2Parts = {
  power: { ftpWatts: number; weightLb: number; value: number } | null;
  hr: { restingHr: number; maxHr: number; maxFrom: 'rides' | 'age'; value: number } | null;
};

export type Vo2Estimate = {
  value: number;
  low: number;
  high: number;
  source: Vo2Source;
  parts: Vo2Parts;
  /** The two methods are more than 20% apart, so the range spans both and the inputs need a look. */
  disagree: boolean;
};

/** Half-width of the plausible range, as a fraction of the point estimate, per source. */
const MARGIN: Record<Vo2Source, number> = {
  power: 0.09, // ~5-12% field-estimate spread from FTP-derived MAP
  hr: 0.14, // cruder, non-exercise formula — wider band
  blended: 0.07, // two independent methods agreeing narrows things a bit
};

const r1 = (n: number) => Math.round(n * 10) / 10;

function withMargin(value: number, source: Vo2Source, parts: Vo2Parts): Vo2Estimate {
  const margin = value * MARGIN[source];
  let low = value - margin;
  let high = value + margin;
  let disagree = false;
  if (parts.power && parts.hr) {
    const a = parts.power.value;
    const b = parts.hr.value;
    disagree = Math.abs(a - b) / ((a + b) / 2) > 0.2;
    // Never claim more certainty than the two methods share.
    low = Math.min(low, a, b);
    high = Math.max(high, a, b);
  }
  return { value: r1(value), low: r1(low), high: r1(high), source, parts, disagree };
}

/** The highest heart rate ever recorded across saved rides, or null without any. */
export function observedMaxBpmFromHistory(sessions: { summary?: { maxBpm?: number | null } | null }[]): number | null {
  let max = 0;
  for (const session of sessions) {
    const bpm = session.summary?.maxBpm;
    if (bpm != null && bpm > max) max = bpm;
  }
  return max > 0 ? max : null;
}

export type Vo2Inputs = {
  /** Only pass an FTP the rider actually set — the app default is a placeholder. */
  ftpWatts?: number | null;
  weightLb?: number | null;
  ageYears?: number | null;
  restingHr?: number | null;
  /** The highest bpm ever actually recorded on a ride, if any — beats an age formula when we have it. */
  observedMaxBpm?: number | null;
};

/**
 * Combines whichever estimates the rider's data supports. Needs at least one
 * of: (FTP + weight), or (resting HR + a way to know max HR — either an
 * observed max or an age to estimate one from). Returns null otherwise.
 */
export function vo2MaxEstimate(input: Vo2Inputs): Vo2Estimate | null {
  const powerValue =
    input.ftpWatts != null && input.weightLb != null ? vo2FromPower(input.ftpWatts, input.weightLb) : null;
  const fromRides = input.observedMaxBpm != null && input.observedMaxBpm > 0;
  const maxHr = fromRides ? input.observedMaxBpm! : input.ageYears != null ? estimateMaxHr(input.ageYears) : null;
  const hrValue = input.restingHr != null && maxHr != null ? vo2FromHr(input.restingHr, maxHr) : null;
  const parts: Vo2Parts = {
    power: powerValue != null ? { ftpWatts: input.ftpWatts!, weightLb: input.weightLb!, value: r1(powerValue) } : null,
    hr:
      hrValue != null
        ? { restingHr: input.restingHr!, maxHr: maxHr!, maxFrom: fromRides ? 'rides' : 'age', value: r1(hrValue) }
        : null,
  };
  if (powerValue != null && hrValue != null) return withMargin((powerValue + hrValue) / 2, 'blended', parts);
  if (powerValue != null) return withMargin(powerValue, 'power', parts);
  if (hrValue != null) return withMargin(hrValue, 'hr', parts);
  return null;
}

/** Convenience wrapper: settings + ride history in, a ready-to-render section out. Shared by the Fitness screen, ride email, and ride share PDF so they never disagree with each other. */
export function currentVo2Section(input: {
  ftpWatts?: number | null;
  /** False while FTP is still the app default; the power method is skipped then. */
  ftpSetByRider?: boolean;
  weightLb?: number | null;
  ageYears?: number | null;
  sex?: Sex | null;
  restingHr?: number | null;
  sessions: { summary?: { maxBpm?: number | null } | null }[];
}): { estimate: Vo2Estimate; category: Vo2Category | null } | null {
  const estimate = vo2MaxEstimate({
    ftpWatts: input.ftpSetByRider ? input.ftpWatts : null,
    weightLb: input.weightLb,
    ageYears: input.ageYears,
    restingHr: input.restingHr,
    observedMaxBpm: observedMaxBpmFromHistory(input.sessions),
  });
  if (!estimate) return null;
  return { estimate, category: vo2MaxCategory(estimate.value, input.ageYears ?? null, input.sex ?? null) };
}

export type Sex = 'male' | 'female';

/** Where the value sits among the rider's sex and five-year age group, in plain words (FRIEND registry percentiles). */
export type Vo2Category = StandingLevel;

/** Null without an age or sex to place it against. */
export function vo2MaxCategory(value: number, ageYears: number | null, sex: Sex | null): Vo2Category | null {
  if (ageYears == null || sex == null) return null;
  return standing(value, ageYears, sex).level;
}
