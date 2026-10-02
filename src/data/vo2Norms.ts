/**
 * Reference standards for cardiorespiratory fitness (VO2max, ml/kg/min),
 * directly measured by cardiopulmonary exercise testing on a treadmill.
 *
 * Source: Kaminsky LA, Arena R, Myers J, et al. "Updated Reference
 * Standards for Cardiorespiratory Fitness Measured with Cardiopulmonary
 * Exercise Testing: Data from the Fitness Registry and the Importance of
 * Exercise National Database (FRIEND)." Mayo Clinic Proceedings.
 * 2022;97(2):285-293. doi:10.1016/j.mayocp.2021.08.020
 *
 * 22,379 tests of apparently healthy adults aged 20–89 from 34 US
 * laboratories (16,278 on a treadmill, the table below). Values are the
 * published 10th…90th percentiles per sex and age decade, plus mean and SD.
 *
 * The same paper has a cycle-ergometer table, but that group was markedly
 * less fit (far more than the usual bike-vs-treadmill difference), so
 * ranking riders against it would flatter them. The treadmill table is the
 * larger, standard yardstick. Bike-derived values tend to run a little
 * lower than treadmill ones, so if anything this comparison is slightly
 * tough on riders.
 */

export type NormBand = {
  /** Inclusive age range. */
  minAge: number;
  maxAge: number;
  n: number;
  /** VO2max at the 10th, 20th, … 90th percentile. */
  deciles: readonly [number, number, number, number, number, number, number, number, number];
  mean: number;
  sd: number;
};

export const VO2_NORMS_SOURCE = {
  short: 'FRIEND registry, Mayo Clinic Proceedings, 2022',
  tests: 16_278,
  url: 'https://doi.org/10.1016/j.mayocp.2021.08.020',
  citation:
    'Kaminsky LA, Arena R, Myers J, et al. Updated Reference Standards for Cardiorespiratory Fitness Measured with Cardiopulmonary Exercise Testing: Data from the Fitness Registry and the Importance of Exercise National Database (FRIEND). Mayo Clin Proc. 2022;97(2):285-293.',
} as const;

export const VO2_NORMS: Record<'male' | 'female', readonly NormBand[]> = {
  male: [
    { minAge: 20, maxAge: 29, n: 1278, deciles: [28.6, 35.2, 40.0, 43.6, 46.5, 49.0, 51.9, 54.5, 58.6], mean: 45.2, sd: 11.8 },
    { minAge: 30, maxAge: 39, n: 1473, deciles: [24.9, 29.8, 33.5, 37.0, 39.7, 43.4, 46.4, 50.0, 55.5], mean: 40.0, sd: 11.8 },
    { minAge: 40, maxAge: 49, n: 2119, deciles: [22.1, 26.7, 29.7, 32.4, 35.3, 37.9, 40.9, 45.2, 50.8], mean: 35.8, sd: 10.8 },
    { minAge: 50, maxAge: 59, n: 2082, deciles: [18.6, 22.2, 24.5, 26.9, 29.2, 31.8, 34.3, 38.3, 43.4], mean: 30.2, sd: 9.7 },
    { minAge: 60, maxAge: 69, n: 1663, deciles: [15.8, 18.5, 20.7, 22.8, 24.6, 26.5, 28.7, 32.0, 37.1], mean: 25.4, sd: 8.3 },
    { minAge: 70, maxAge: 79, n: 776, deciles: [13.6, 15.9, 17.3, 19.1, 20.6, 22.2, 23.8, 25.9, 29.4], mean: 21.2, sd: 6.5 },
    { minAge: 80, maxAge: 89, n: 173, deciles: [12.9, 14.8, 16.1, 16.6, 17.6, 18.4, 20.0, 21.4, 22.8], mean: 17.9, sd: 3.9 },
  ],
  female: [
    { minAge: 20, maxAge: 29, n: 1142, deciles: [22.5, 27.2, 30.8, 34.0, 36.6, 39.0, 41.8, 44.8, 49.0], mean: 36.3, sd: 10.2 },
    { minAge: 30, maxAge: 39, n: 1043, deciles: [18.6, 21.9, 24.2, 26.4, 28.3, 31.0, 33.6, 37.0, 42.1], mean: 29.5, sd: 9.0 },
    { minAge: 40, maxAge: 49, n: 1372, deciles: [17.2, 19.7, 21.8, 23.9, 25.7, 27.7, 30.0, 33.0, 37.8], mean: 26.6, sd: 8.1 },
    { minAge: 50, maxAge: 59, n: 1457, deciles: [16.5, 18.5, 20.1, 21.5, 22.9, 24.6, 26.3, 28.4, 32.4], mean: 23.8, sd: 6.6 },
    { minAge: 60, maxAge: 69, n: 1045, deciles: [13.4, 15.4, 17.0, 18.3, 19.6, 20.9, 22.4, 24.3, 27.3], mean: 20.0, sd: 5.5 },
    { minAge: 70, maxAge: 79, n: 549, deciles: [12.3, 14.0, 15.2, 16.2, 17.2, 18.3, 19.6, 20.8, 22.8], mean: 17.5, sd: 4.2 },
    { minAge: 80, maxAge: 89, n: 106, deciles: [11.4, 12.6, 13.7, 14.7, 15.4, 16.0, 17.3, 18.4, 20.8], mean: 15.9, sd: 4.8 },
  ],
};
