// Supabase Edge Function: delete the signed-in rider's 30/15 cloud data
// and their auth user.
//
// The phone calls this from Settings. The rider's JWT is checked first.
// Cloud rows are removed with the service role via delete_user_cloud_data,
// then the auth user is removed with the Auth admin API. The service role
// key stays in Supabase secrets. It is not in the app.
//
// Deploy on the dedicated 30/15 project only. Never BioAge.
//   npx supabase functions deploy delete-account
//
// Provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { CLOUD_DATA_RPC, isAccountUserId } from './plan.ts';

function reply(status: number, message: string, ok = false): Response {
  const body = ok ? { ok: true } : { ok: false, message };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, 'POST only');

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return reply(500, 'not configured');

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return reply(401, 'not signed in');

  const who = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anon },
  });
  if (!who.ok) return reply(401, 'not signed in');
  const user = (await who.json()) as { id?: string };
  if (!user.id || !isAccountUserId(user.id)) return reply(401, 'not signed in');

  const rpc = await fetch(`${url}/rest/v1/rpc/${CLOUD_DATA_RPC}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${service}`,
      apikey: service,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_uid: user.id }),
  });
  if (!rpc.ok) return reply(502, 'cloud data was not deleted');

  const removed = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${service}`, apikey: service },
  });
  if (!removed.ok && removed.status !== 404) return reply(502, 'auth user was not deleted');
  return reply(200, 'deleted', true);
});
