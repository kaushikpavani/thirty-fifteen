import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '@supabase/supabase-js';
import { mapAuthUser } from './mapUser.ts';
import { storedSessionUser, supabaseAuthStorageKey } from './storageKey.ts';

test('auth storage key is derived from the project host', () => {
  assert.equal(supabaseAuthStorageKey('https://abcdxyz.supabase.co'), 'sb-abcdxyz-auth-token');
  assert.equal(supabaseAuthStorageKey(''), null);
  assert.equal(supabaseAuthStorageKey('not a url'), null);
});

test('a stored session is read without a network round trip', () => {
  const raw = JSON.stringify({
    access_token: 'local',
    refresh_token: 'local',
    user: {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'grace@example.com',
      user_metadata: { full_name: 'Grace Hopper' },
      app_metadata: { provider: 'google' },
    },
  });
  const user = mapAuthUser(storedSessionUser(raw) as User | null);
  assert.equal(user?.id, '22222222-2222-2222-2222-222222222222');
  assert.equal(user?.name, 'Grace');
  assert.equal(user?.provider, 'google');
  assert.equal(storedSessionUser(null), null);
  assert.equal(storedSessionUser('{'), null);
});
