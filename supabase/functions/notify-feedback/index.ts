// Supabase Edge Function: email the 30/15 owner whenever a rider leaves a note.
//
// Triggered by a Database Webhook on INSERT into public.app_feedback.
// Every address and key lives in server-side secrets, never in the app or
// this repo:
//   RESEND_API_KEY           Resend API key
//   FEEDBACK_NOTIFY_TO       where notes go (the owner's inbox)
//   FEEDBACK_WEBHOOK_SECRET  shared secret the webhook sends as x-webhook-secret
//   FEEDBACK_FROM            optional sender; defaults to Resend's test sender,
//                            which can only deliver to the Resend account's own address
// Provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { buildFeedbackEmail, type FeedbackRow } from './email.ts';

function reply(status: number, message: string): Response {
  return new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json' } });
}

/** The signed-in rider's address, so the owner can reply. Null for anonymous notes or on any error. */
async function riderEmail(userId: string | null | undefined): Promise<string | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!userId || !url || !key) return null;
  try {
    const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { email?: string | null };
    return user.email ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, 'POST only');

  // Only the database webhook knows this secret; anyone else calling the
  // function URL can't make it send mail.
  const secret = Deno.env.get('FEEDBACK_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return reply(403, 'forbidden');

  let payload: { type?: string; table?: string; record?: FeedbackRow };
  try {
    payload = await req.json();
  } catch {
    return reply(400, 'bad json');
  }
  if (payload.type !== 'INSERT' || payload.table !== 'app_feedback' || !payload.record) {
    return reply(200, 'ignored');
  }

  const to = Deno.env.get('FEEDBACK_NOTIFY_TO');
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!to || !apiKey) return reply(500, 'not configured: set RESEND_API_KEY and FEEDBACK_NOTIFY_TO');

  const email = buildFeedbackEmail(payload.record, await riderEmail(payload.record.user_id));
  if (!email) return reply(200, 'empty note');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('FEEDBACK_FROM') || '30/15 Notes <onboarding@resend.dev>',
      to: [to],
      subject: email.subject,
      text: email.text,
      html: email.html,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
  });
  if (!res.ok) return reply(502, `resend ${res.status}: ${await res.text()}`);
  return reply(200, 'sent');
});
