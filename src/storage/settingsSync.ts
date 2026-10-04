/**
 * Backing up the rider's settings with their account, decided without
 * touching the network.
 *
 * The rule: a setting changed on this phone since the last successful sync
 * wins; every other setting takes the account's value. That makes the cases
 * that matter safe without comparing clocks between phones:
 *
 * - Reinstall: nothing has been changed on the new install, so everything
 *   comes back from the account. Fresh defaults can never overwrite it.
 * - Reinstall, then a tweak before signing in: only the tweaked setting is
 *   sent; age, weight, FTP and the rest still come back.
 * - Two phones: each setting ends up as whichever phone last changed it and
 *   synced; a change on one phone never wipes an unrelated one on the other.
 * - Offline: changes wait in the pending list and go up on the next sync.
 *
 * What comes back from the account is validated field by field, so a bad or
 * out-of-range value is ignored instead of breaking the app.
 */
import type { WorkoutSettings } from '../types';

type Key = keyof WorkoutSettings;
type Check = (value: unknown) => boolean;

const int = (min: number, max: number): Check => (v) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const num = (min: number, max: number): Check => (v) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const bool: Check = (v) => typeof v === 'boolean';
const orNull = (check: Check): Check => (v) => v === null || check(v);
const text = (pattern: RegExp): Check => (v) => typeof v === 'string' && pattern.test(v);
const oneOf = (...allowed: string[]): Check => (v) => typeof v === 'string' && allowed.includes(v);

/**
 * Every setting that follows the rider's account, with the values the app
 * accepts for it (the same limits the Settings screens enforce). Anything not
 * listed stays on the phone: `ftpChange` is a notice about this phone's last
 * automatic adjustment, not a preference.
 */
export const SYNCED: Partial<Record<Key, Check>> = {
  ftpWatts: int(50, 600),
  hardPct: int(100, 200),
  easyPct: int(20, 80),
  warmupMin: int(5, 30),
  sets: int(1, 6),
  reps: int(4, 20),
  workSec: int(15, 60),
  recoverSec: int(10, 30),
  betweenSetRestMin: int(1, 10),
  cooldownMin: int(3, 20),
  speechEnabled: bool,
  voiceRate: num(0.5, 2),
  cueLeadMs: num(0, 5000),
  beepsEnabled: bool,
  hapticsEnabled: bool,
  musicEnabled: bool,
  musicGenre: text(/^[a-z0-9]{1,24}$/),
  coachVoice: oneOf('female', 'male', 'off'),
  coachLanguage: text(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/),
  spokenCount: bool,
  ageYears: orNull(int(13, 99)),
  sex: orNull(oneOf('male', 'female')),
  weightLb: orNull(num(70, 400)),
  restingHr: orNull(int(30, 110)),
  ftpSetByRider: bool,
  ftpSuggestionDismissed: orNull(text(/^[\w-]{1,80}$/)),
  ftpAuto: bool,
  ftpBreakHandled: orNull(text(/^[\w-]{1,80}$/)),
  profilePromptSeen: bool,
};

export const SYNCED_KEYS = Object.keys(SYNCED) as Key[];

export type CloudSettings = Partial<Record<Key, unknown>>;

/** The part of the settings that is stored with the account. */
export function cloudSettings(settings: WorkoutSettings): CloudSettings {
  const out: CloudSettings = {};
  for (const key of SYNCED_KEYS) {
    const value = settings[key];
    if (value !== undefined && SYNCED[key]!(value)) out[key] = value;
  }
  return out;
}

/**
 * Settings read back from the account, keeping only fields the app knows and
 * values it accepts. Null when there is nothing usable (no backup yet).
 */
export function parseCloudSettings(raw: unknown): CloudSettings | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const out: CloudSettings = {};
  for (const key of SYNCED_KEYS) {
    if (key in source && SYNCED[key]!(source[key])) out[key] = source[key];
  }
  return Object.keys(out).length ? out : null;
}

const same = (a: unknown, b: unknown) => a === b || (a == null && b == null);

/** The synced settings that differ between two versions. */
export function changedKeys(prev: WorkoutSettings, next: WorkoutSettings): Key[] {
  return SYNCED_KEYS.filter((key) => !same(prev[key], next[key]));
}

export type SettingsPlan = {
  /** Settings to adopt on this phone, or null if it is already up to date. */
  apply: Partial<WorkoutSettings> | null;
  /** What to store with the account, or null if it is already up to date. */
  upload: CloudSettings | null;
};

export function planSettingsSync(args: {
  local: WorkoutSettings;
  /** What the account holds, already validated; null if it holds nothing yet. */
  remote: CloudSettings | null;
  /** Settings changed on this phone since the last successful sync. */
  pending: readonly string[];
}): SettingsPlan {
  const mine = cloudSettings(args.local);
  // First backup for this account: there is nothing to restore, so store what the phone has.
  if (!args.remote) return { apply: null, upload: mine };

  const merged: CloudSettings = { ...args.remote };
  // Settings the account has never seen (added in a newer version of the app) are filled in from the phone.
  for (const key of SYNCED_KEYS) if (!(key in merged) && key in mine) merged[key] = mine[key];
  // Changes made here since the last sync win.
  for (const key of SYNCED_KEYS) if (args.pending.includes(key) && key in mine) merged[key] = mine[key];

  const apply: Partial<Record<Key, unknown>> = {};
  for (const key of SYNCED_KEYS) if (key in merged && !same(merged[key], args.local[key])) apply[key] = merged[key];
  const differs = SYNCED_KEYS.some((key) => !same(merged[key], args.remote![key]));

  return {
    apply: Object.keys(apply).length ? (apply as Partial<WorkoutSettings>) : null,
    upload: differs ? merged : null,
  };
}
