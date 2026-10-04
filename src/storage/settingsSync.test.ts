import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkoutSettings } from '../types.ts';
import { DEFAULT_SETTINGS } from '../workout/defaults.ts';
import { changedKeys, cloudSettings, parseCloudSettings, planSettingsSync, SYNCED_KEYS, type CloudSettings } from './settingsSync.ts';

const mine: WorkoutSettings = {
  ...DEFAULT_SETTINGS,
  ftpWatts: 215,
  ftpSetByRider: true,
  sets: 3,
  reps: 10,
  warmupMin: 15,
  coachVoice: 'male',
  musicGenre: 'edm',
  ageYears: 46,
  sex: 'male',
  weightLb: 179,
  restingHr: 52,
  profilePromptSeen: true,
};

/** A phone plus the account, driven through the same plan the app uses. */
function makePhone(settings: WorkoutSettings = { ...DEFAULT_SETTINGS }) {
  const phone = { settings, pending: [] as string[] };
  return {
    phone,
    change(patch: Partial<WorkoutSettings>) {
      const next = { ...phone.settings, ...patch };
      phone.pending = [...new Set([...phone.pending, ...changedKeys(phone.settings, next)])];
      phone.settings = next;
    },
    /** Returns the account's new contents. `online: false` leaves everything as it was. */
    sync(account: CloudSettings | null, online = true): CloudSettings | null {
      if (!online) return account;
      const plan = planSettingsSync({ local: phone.settings, remote: parseCloudSettings(account), pending: phone.pending });
      if (plan.apply) phone.settings = { ...phone.settings, ...plan.apply };
      phone.pending = [];
      return plan.upload ?? account;
    },
  };
}

test('delete the app and reinstall: every setting comes back and the fresh defaults never overwrite the account', () => {
  const old = makePhone({ ...DEFAULT_SETTINGS });
  old.change(mine);
  let account = old.sync(null);
  assert.equal(account!.ftpWatts, 215);

  const fresh = makePhone(); // reinstalled: defaults, nothing changed here
  account = fresh.sync(account);
  for (const key of SYNCED_KEYS) assert.deepEqual(fresh.phone.settings[key], mine[key], `${key} did not come back`);
  // The account is exactly as it was: the new install wrote nothing.
  assert.deepEqual(account, cloudSettings(mine));
});

test('reinstall, tweak one thing before signing in: only that setting is sent, the rest still come back', () => {
  const account0 = cloudSettings(mine);
  const fresh = makePhone();
  fresh.change({ reps: 8 }); // played with the stepper while signed out
  const account = fresh.sync(account0)!;
  assert.equal(fresh.phone.settings.reps, 8);
  assert.equal(account.reps, 8);
  for (const key of ['ftpWatts', 'ageYears', 'sex', 'weightLb', 'restingHr', 'sets', 'coachVoice', 'musicGenre'] as const) {
    assert.deepEqual(fresh.phone.settings[key], mine[key], `${key} was lost`);
    assert.deepEqual(account[key], mine[key], `${key} was overwritten in the account`);
  }
});

test('the first backup for an account stores what the phone has', () => {
  const plan = planSettingsSync({ local: mine, remote: null, pending: [] });
  assert.equal(plan.apply, null);
  assert.deepEqual(plan.upload, cloudSettings(mine));
});

test('two phones: each setting ends up as the last one changed, and unrelated changes never wipe each other', () => {
  let account: CloudSettings | null = cloudSettings(mine);
  const a = makePhone({ ...mine });
  const b = makePhone({ ...mine });
  a.change({ ftpWatts: 225 });
  b.change({ coachVoice: 'female', musicGenre: 'opera' });
  account = a.sync(account);
  account = b.sync(account);
  account = a.sync(account);
  for (const phone of [a, b]) {
    assert.equal(phone.phone.settings.ftpWatts, 225);
    assert.equal(phone.phone.settings.coachVoice, 'female');
    assert.equal(phone.phone.settings.musicGenre, 'opera');
    assert.equal(phone.phone.settings.weightLb, 179);
  }
  // Both change the same setting: the one that syncs last wins, on both phones.
  a.change({ sets: 4 });
  b.change({ sets: 2 });
  account = a.sync(account);
  account = b.sync(account);
  account = a.sync(account);
  assert.deepEqual([a.phone.settings.sets, b.phone.settings.sets, account!.sets], [2, 2, 2]);
});

test('changes made offline wait and go up on the next sync', () => {
  let account: CloudSettings | null = cloudSettings(mine);
  const phone = makePhone({ ...mine });
  phone.change({ weightLb: 175 });
  account = phone.sync(account, false);
  assert.equal(account!.weightLb, 179);
  assert.deepEqual(phone.phone.pending, ['weightLb']);
  phone.change({ restingHr: 50 });
  account = phone.sync(account);
  assert.deepEqual([account!.weightLb, account!.restingHr], [175, 50]);
});

test('once in step, syncing again does nothing at all', () => {
  const plan = planSettingsSync({ local: mine, remote: cloudSettings(mine), pending: [] });
  assert.deepEqual(plan, { apply: null, upload: null });
});

test('bad values in the account are ignored, field by field', () => {
  const dirty = {
    ...cloudSettings(mine),
    ftpWatts: 9000,
    sets: 'three',
    coachVoice: 'direct',
    weightLb: -5,
    sex: 'other',
    musicGenre: '../etc',
    unknownFutureSetting: 42,
    reps: 12,
  };
  const parsed = parseCloudSettings(dirty)!;
  assert.equal(parsed.reps, 12);
  for (const key of ['ftpWatts', 'sets', 'coachVoice', 'weightLb', 'sex', 'musicGenre'] as const) assert.equal(key in parsed, false, key);
  assert.equal('unknownFutureSetting' in parsed, false);
  // Restoring from it keeps the phone's own value wherever the account's was unusable.
  const phone = makePhone();
  phone.sync(dirty);
  assert.equal(phone.phone.settings.reps, 12);
  assert.equal(phone.phone.settings.ftpWatts, DEFAULT_SETTINGS.ftpWatts);
  assert.equal(phone.phone.settings.coachVoice, DEFAULT_SETTINGS.coachVoice);
  for (const junk of [null, 'text', 42, [], {}, { nothing: true }]) assert.equal(parseCloudSettings(junk), null);
});

test('clearing a value (age back to "not set") is a change like any other and syncs', () => {
  let account: CloudSettings | null = cloudSettings(mine);
  const phone = makePhone({ ...mine });
  phone.change({ ageYears: null });
  account = phone.sync(account);
  assert.equal(account!.ageYears, null);
  const other = makePhone({ ...mine });
  other.sync(account);
  assert.equal(other.phone.settings.ageYears, null);
});

test('the notice about this phone’s last automatic FTP change stays on the phone', () => {
  const withNotice = { ...mine, ftpChange: { from: 200, to: 215, reason: 'rides', at: '2026-10-01T00:00:00Z' } };
  assert.equal('ftpChange' in cloudSettings(withNotice), false);
  assert.deepEqual(changedKeys(mine, withNotice), []);
});

test('every default setting is valid to store, so a first backup never drops anything', () => {
  const stored = cloudSettings(DEFAULT_SETTINGS);
  for (const key of SYNCED_KEYS) {
    if (DEFAULT_SETTINGS[key] !== undefined) assert.ok(key in stored, `default ${key} is rejected by its own check`);
  }
  assert.deepEqual(parseCloudSettings(JSON.parse(JSON.stringify(stored))), stored);
});
