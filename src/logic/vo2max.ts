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
 * - Cooper Institute normative VO2max table (age × sex bands), used only to
 *   label a value "fair/good/excellent" etc., not to compute it.
 */

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

type Band = { minAge: number; maxAge: number; cuts: [number, number, number, number, number] };

// Cooper Institute normative VO2max data (ml/kg/min), Physical Fitness
// Specialist Certification Manual. cuts = the top of [very poor, poor, fair,
// good, excellent]; anything above the 5th cut is "superior".
const COOPER_FEMALE: Band[] = [
  { minAge: 13, maxAge: 19, cuts: [24.9, 30.9, 34.9, 38.9, 41.9] },
  { minAge: 20, maxAge: 29, cuts: [23.5, 28.9, 32.9, 36.9, 41.0] },
  { minAge: 30, maxAge: 39, cuts: [22.7, 26.9, 31.4, 35.6, 40.0] },
  { minAge: 40, maxAge: 49, cuts: [20.9, 24.4, 28.9, 32.8, 36.9] },
  { minAge: 50, maxAge: 59, cuts: [20.1, 22.7, 26.9, 31.4, 35.7] },
  { minAge: 60, maxAge: 999, cuts: [17.4, 20.1, 24.4, 30.2, 31.4] },
];

const COOPER_MALE: Band[] = [
  { minAge: 13, maxAge: 19, cuts: [34.9, 38.3, 45.1, 50.9, 55.9] },
  { minAge: 20, maxAge: 29, cuts: [32.9, 36.4, 42.4, 46.4, 52.4] },
  { minAge: 30, maxAge: 39, cuts: [31.4, 35.4, 40.9, 44.9, 49.4] },
  { minAge: 40, maxAge: 49, cuts: [30.1, 33.5, 38.9, 43.7, 48.0] },
  { minAge: 50, maxAge: 59, cuts: [26.0, 30.9, 35.7, 40.9, 45.3] },
  { minAge: 60, maxAge: 999, cuts: [20.4, 26.0, 32.2, 36.4, 44.2] },
];

export const VO2_CATEGORY_LABELS = ['Very poor', 'Poor', 'Fair', 'Good', 'Excellent', 'Superior'] as const;
export type Vo2Category = (typeof VO2_CATEGORY_LABELS)[number];

/** Looks up the Cooper Institute category for a value, age and sex. Null without an age or sex to place it against. */
export function vo2MaxCategory(value: number, ageYears: number | null, sex: Sex | null): Vo2Category | null {
  if (ageYears == null || sex == null) return null;
  const table = sex === 'male' ? COOPER_MALE : COOPER_FEMALE;
  const band = table.find((b) => ageYears >= b.minAge && ageYears <= b.maxAge) ?? table[table.length - 1]!;
  for (let i = 0; i < band.cuts.length; i++) {
    if (value <= band.cuts[i]!) return VO2_CATEGORY_LABELS[i]!;
  }
  return VO2_CATEGORY_LABELS[5]!;
}
