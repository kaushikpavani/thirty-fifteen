/**
 * Where a VO2max value sits among people of the same sex and five-year age
 * group, using the FRIEND registry's published percentiles (see data/vo2Norms).
 *
 * Between the 10th and 90th percentile the answer comes straight from the
 * published deciles (linear between neighbours). Beyond them the paper
 * gives no points, so the tails follow a normal curve anchored to the
 * median and the nearest published decile on that side, which keeps
 * everything continuous at the 10th and 90th.
 */
import { VO2_NORMS, type NormBand } from '../data/vo2Norms';

export type StandingSex = 'male' | 'female';

const blend = (own: number, other: number) => 0.75 * own + 0.25 * other;

/**
 * The five-year band for this rider. Ages outside 20–89 use the nearest band.
 *
 * FRIEND publishes ten-year groups. Fitness falls steadily with age, so a
 * 49-year-old compared against all of 40–49 is being ranked against people
 * up to nine years younger. To narrow that, each published decade is treated
 * as describing its middle age (25, 35, …) and a five-year group is read off
 * the straight line between the two nearest decades: three parts its own
 * decade, one part the neighbour it leans towards. The youngest and oldest
 * half-decades (20–24, 85+) have no neighbour on that side, so they use
 * their own decade as published rather than extrapolating.
 */
export function normBand(ageYears: number, sex: StandingSex): NormBand {
  const bands = VO2_NORMS[sex];
  const age = Math.min(89, Math.max(20, Math.floor(ageYears)));
  const i = Math.max(0, bands.findIndex((b) => age >= b.minAge && age <= b.maxAge));
  const own = bands[i]!;
  const upper = age >= own.minAge + 5;
  const other = bands[upper ? i + 1 : i - 1] ?? own;
  return {
    minAge: upper ? own.minAge + 5 : own.minAge,
    maxAge: upper ? own.maxAge : own.minAge + 4,
    n: own.n,
    deciles: own.deciles.map((d, k) => blend(d, other.deciles[k]!)) as unknown as NormBand['deciles'],
    mean: blend(own.mean, other.mean),
    sd: blend(own.sd, other.sd),
  };
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

const Z10 = 1.2815515655; // z-score of the 90th percentile; the 10th is its mirror.

/** Percent of the group at or below this value, 0–100. */
export function percentileOf(value: number, band: NormBand): number {
  const d = band.deciles;
  const median = d[4];
  if (value <= d[0]) return 100 * phi(((value - median) / (median - d[0])) * Z10);
  if (value >= d[8]) return 100 * phi(((value - median) / (d[8] - median)) * Z10);
  for (let i = 0; i < 8; i++) {
    if (value < d[i + 1]!) return 10 * (i + 1) + (10 * (value - d[i]!)) / (d[i + 1]! - d[i]!);
  }
  return 90;
}

/** The VO2max at a given percentile (inverse of percentileOf). */
export function valueAtPercentile(pct: number, band: NormBand): number {
  const d = band.deciles;
  if (pct >= 10 && pct <= 90) {
    const i = Math.min(7, Math.floor(pct / 10) - 1);
    return d[i]! + ((pct - 10 * (i + 1)) / 10) * (d[i + 1]! - d[i]!);
  }
  // Tails: bisect the monotone percentile curve.
  let lo = pct < 10 ? d[4] - 4 * (d[4] - d[0]) : d[8];
  let hi = pct < 10 ? d[0] : d[4] + 4 * (d[8] - d[4]);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (percentileOf(mid, band) < pct) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export type Bin = { x0: number; x1: number; /** Percent of the group in this bin. */ share: number };

/** The group's distribution as a histogram, built from the published percentiles. */
export function histogram(band: NormBand, binWidth = 2): { bins: Bin[]; min: number; max: number } {
  const d = band.deciles;
  const lo = Math.max(6, d[4] - 2.5 * ((d[4] - d[0]) / Z10));
  const hi = d[4] + 2.6 * ((d[8] - d[4]) / Z10);
  const min = Math.floor(lo / binWidth) * binWidth;
  const max = Math.ceil(hi / binWidth) * binWidth;
  const bins: Bin[] = [];
  for (let x = min; x < max; x += binWidth) {
    bins.push({ x0: x, x1: x + binWidth, share: percentileOf(x + binWidth, band) - percentileOf(x, band) });
  }
  return { bins, min, max };
}

export const STANDING_LEVELS = ['Low', 'Below average', 'Average', 'Above average', 'Excellent', 'Superior'] as const;
export type StandingLevel = (typeof STANDING_LEVELS)[number];

/** Plain words for a percentile. Fifths of the group, with the top fifth split at the 95th. */
export function levelFor(percentile: number): StandingLevel {
  if (percentile >= 95) return 'Superior';
  if (percentile >= 80) return 'Excellent';
  if (percentile >= 60) return 'Above average';
  if (percentile >= 40) return 'Average';
  if (percentile >= 20) return 'Below average';
  return 'Low';
}

export type Standing = {
  band: NormBand;
  /** "men aged 40–49" */
  group: string;
  /** 1–99, rounded. */
  percentile: number;
  level: StandingLevel;
  median: number;
  /** The next round percentile above, and how far away it is. Null at the very top. */
  next: { percentile: number; value: number; gap: number } | null;
};

export function standing(value: number, ageYears: number, sex: StandingSex): Standing {
  const band = normBand(ageYears, sex);
  const exact = percentileOf(value, band);
  const percentile = Math.min(99, Math.max(1, Math.round(exact)));
  const older = band.maxAge >= 89;
  const group = `${sex === 'male' ? 'men' : 'women'} aged ${band.minAge}${older ? '+' : `–${band.maxAge}`}`;
  let next: Standing['next'] = null;
  const targets = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95];
  for (const t of targets) {
    if (t <= exact) continue;
    const v = Math.round(valueAtPercentile(t, band) * 10) / 10;
    const gap = Math.round((v - value) * 10) / 10;
    // A target that's a rounding error away isn't a goal; take the one after.
    if (gap >= 0.5) {
      next = { percentile: t, value: v, gap };
      break;
    }
  }
  return { band, group, percentile, level: levelFor(exact), median: Math.round(band.deciles[4] * 10) / 10, next };
}
