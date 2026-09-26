import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCloudConfig } from '../auth/config.ts';
import { isAnalyticsEvent, PII_PROPERTY_KEYS, sanitizeEventProperties } from './analytics.ts';
import { profileWrite } from './profileWrite.ts';

test('analytics properties drop names, note text, and email addresses', () => {
  const clean = sanitizeEventProperties({
    ftp_watts: 125,
    provider: 'google',
    delivery: 'queued',
    email: 'rider@example.com',
    display_name: 'Ada',
    body: 'the bike felt great',
    name: 'Ada',
    note: 'ada@example.com',
  });
  assert.deepEqual(clean, { ftp_watts: 125, provider: 'google', delivery: 'queued' });
  for (const key of PII_PROPERTY_KEYS) {
    assert.equal(Object.hasOwn(clean, key), false);
  }
});

test('event names stay on the known list', () => {
  assert.equal(isAnalyticsEvent('workout_finish'), true);
  assert.equal(isAnalyticsEvent('sign_in'), true);
  assert.equal(isAnalyticsEvent('feedback'), true);
  assert.equal(isAnalyticsEvent('workout_started'), false);
  assert.equal(isAnalyticsEvent('upgrade'), false);
});

test('profile upsert copies ftp from the phone and omits email', () => {
  const row = profileWrite({ id: 'user-1', name: 'Ada Lovelace' }, 125, '2026-09-26T08:00:00.000Z');
  assert.equal(row.ftp_watts, 125);
  assert.equal(row.display_name, 'Ada Lovelace');
  assert.equal('email' in row, false);
  const low = profileWrite({ id: 'user-1', name: null }, 49, '2026-09-26T08:00:00.000Z');
  assert.equal('ftp_watts' in low, false);
  const high = profileWrite({ id: 'user-1', name: 'x'.repeat(100) }, 601, '2026-09-26T08:00:00.000Z');
  assert.equal(high.display_name?.length, 80);
  assert.equal('ftp_watts' in high, false);
});

test('a blank Supabase config stays fully local', () => {
  assert.equal(hasCloudConfig('', ''), false);
  assert.equal(hasCloudConfig('https://example.supabase.co', ''), false);
  assert.equal(hasCloudConfig(' https://example.supabase.co ', ' publishable '), true);
});
