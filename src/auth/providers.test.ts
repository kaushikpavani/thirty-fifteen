import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  appleFullName,
  appleIdTokenCredentials,
  isAppleCancel,
  providerLabel,
  signInLabel,
  signInProviders,
} from './providers.ts';
import { shareSignInAlert } from '../logic/shareGate.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('iOS offers Apple beside Google, with Apple first', () => {
  assert.deepEqual(signInProviders('ios'), ['apple', 'google']);
  assert.deepEqual(signInProviders('android'), ['google']);
  assert.deepEqual(signInProviders('web'), ['google']);
  assert.equal(signInLabel('apple', null), 'Continue with Apple');
  assert.equal(signInLabel('google', null), 'Continue with Google');
  assert.equal(signInLabel('apple', 'apple'), 'Opening…');
  assert.equal(signInLabel('google', 'apple'), 'Continue with Google');
  assert.equal(providerLabel('apple'), 'Apple');
  assert.equal(providerLabel('google'), 'Google');
});

test('a dismissed Apple sheet is not a sign-in failure', () => {
  assert.equal(isAppleCancel({ code: 'ERR_REQUEST_CANCELED' }), true);
  assert.equal(isAppleCancel(new Error('The authorization attempt failed')), false);
  assert.equal(isAppleCancel(null), false);
});

test('the Apple identity token is sent to Supabase as an Apple id token', () => {
  assert.deepEqual(appleIdTokenCredentials('  header.payload.sig  '), {
    provider: 'apple',
    token: 'header.payload.sig',
  });
  assert.equal(appleIdTokenCredentials('   '), null);
  assert.equal(appleFullName(null), null);
  assert.equal(appleFullName({ givenName: 'Kaushik', familyName: 'Pavani' }), 'Kaushik Pavani');
  assert.equal(appleFullName({ givenName: '  ', familyName: null }), null);
  assert.equal(appleFullName({ givenName: 'Ada', middleName: 'M', familyName: 'Lovelace' }), 'Ada M Lovelace');
});

test('share sign-in offers the same providers and does not gate a ride', () => {
  const calls: string[] = [];
  const alert = shareSignInAlert({ signIn: (provider) => calls.push(provider) }, 'ios');
  assert.deepEqual(
    alert.buttons.map((button) => button.text),
    ['Cancel', 'Continue with Apple', 'Continue with Google'],
  );
  alert.buttons[1]?.onPress?.();
  alert.buttons[2]?.onPress?.();
  assert.deepEqual(calls, ['apple', 'google']);
  const android = shareSignInAlert({ signIn: () => undefined }, 'android');
  assert.deepEqual(
    android.buttons.map((button) => button.text),
    ['Cancel', 'Continue with Google'],
  );
  assert.match(android.message, /from your phone/);
  assert.doesNotMatch(android.message, /iPhone/);
  assert.match(alert.message, /from your iPhone/);
  const web = shareSignInAlert({ signIn: () => undefined }, 'web');
  assert.deepEqual(
    web.buttons.map((button) => button.text),
    ['Cancel', 'Continue with Google'],
  );
  const home = fs.readFileSync(path.join(root, 'src/screens/HomeScreen.tsx'), 'utf8');
  const startFn = home.slice(home.indexOf('const start = async'), home.indexOf('const meterName'));
  assert.doesNotMatch(startFn, /auth|signIn|supabase|bluetooth/i);
  assert.match(home, /<Pill label="Start"/);
  assert.doesNotMatch(home, /label="Start"[^>\n]*disabled/);
});
