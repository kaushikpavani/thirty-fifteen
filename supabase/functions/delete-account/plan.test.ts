import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CLOUD_DATA_RPC, accountDeleteOrder, cloudDataDeleteOrder, isAccountUserId } from './plan.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const here = path.dirname(fileURLToPath(import.meta.url));

test('cloud rows are removed before the auth user', () => {
  const order = accountDeleteOrder();
  assert.deepEqual(order.slice(0, -1), [...cloudDataDeleteOrder()]);
  assert.equal(order.at(-1), 'auth.users');
  assert.ok(order.indexOf('app_events') < order.indexOf('auth.users'));
  assert.ok(order.indexOf('app_feedback') < order.indexOf('profiles'));
  assert.ok(order.indexOf('profiles') < order.indexOf('auth.users'));
});

test('only a uuid from the verified session is a rider id', () => {
  assert.equal(isAccountUserId('11111111-1111-4111-8111-111111111111'), true);
  assert.equal(isAccountUserId('not-a-user'), false);
  assert.equal(isAccountUserId(''), false);
  assert.equal(isAccountUserId('11111111-1111-4111-8111-111111111111;drop'), false);
});

test('the migration deletes cloud data as service role only, in the same order', () => {
  const sql = fs.readFileSync(
    path.join(root, 'supabase/migrations/20261116120000_delete_account_edge.sql'),
    'utf8',
  );
  assert.match(sql, new RegExp(`function public\\.${CLOUD_DATA_RPC}\\(p_uid uuid\\)`));
  assert.match(sql, /revoke all on function public\.delete_user_cloud_data\(uuid\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.delete_user_cloud_data\(uuid\) to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.delete_user_cloud_data\(uuid\) to (anon|authenticated)/);
  assert.match(sql, /Do not use the BioAge project/);
  const body = sql.slice(sql.indexOf(`function public.${CLOUD_DATA_RPC}`));
  let at = 0;
  for (const name of cloudDataDeleteOrder()) {
    const next = body.indexOf(name, at);
    assert.ok(next > at, name);
    at = next;
  }
  assert.equal(body.includes('auth.users'), false);
});

test('the edge function verifies the caller, then uses the service role for data and the auth user', () => {
  const index = fs.readFileSync(path.join(here, 'index.ts'), 'utf8');
  assert.match(index, /CLOUD_DATA_RPC/);
  assert.match(index, /\/auth\/v1\/user/);
  assert.match(index, /\/auth\/v1\/admin\/users\//);
  assert.match(index, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(index, /Never BioAge/);
  assert.match(index, /p_uid: user\.id/);
  assert.doesNotMatch(index, /req\.json|body\.user/);
  assert.doesNotMatch(index, /eyJ[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(index, /service_role['"]\s*:\s*['"]/);
});
