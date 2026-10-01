# notify-feedback

Emails the owner whenever a rider leaves a note ("Leave a note" → `public.app_feedback`).
A Database Webhook calls this function on every insert; the function sends the note
through [Resend](https://resend.com). The owner's address lives only in a Supabase
secret, never in the app or this repo. Signed-in riders' addresses are set as
reply-to, so replying answers them directly.

## One-time setup

1. **Resend**: sign up with the inbox that should receive notes, then create an API
   key. Resend's test sender (`onboarding@resend.dev`) can only deliver to the
   account's own address, which is exactly what this needs, so no domain is required.

2. **Link the project** (the ref is the subdomain of `EXPO_PUBLIC_SUPABASE_URL`):

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```

3. **Secrets** (keep the webhook secret; step 5 needs it):

   ```bash
   SECRET=$(openssl rand -hex 24); echo "$SECRET"
   npx supabase secrets set \
     RESEND_API_KEY=re_xxxxxxxx \
     FEEDBACK_NOTIFY_TO=<your inbox> \
     FEEDBACK_WEBHOOK_SECRET="$SECRET"
   ```

   Optional: `FEEDBACK_FROM="30/15 <notes@your-domain>"` once you verify a domain in Resend.

4. **Deploy** (the function checks its own secret, so it skips Supabase's JWT check):

   ```bash
   npx supabase functions deploy notify-feedback --no-verify-jwt
   ```

5. **Webhook**: Supabase dashboard → Database → Webhooks → Create a new hook
   - Table `app_feedback`, event **Insert**
   - Type **HTTP Request**, method **POST**
   - URL `https://<project-ref>.supabase.co/functions/v1/notify-feedback`
   - HTTP header `x-webhook-secret` = the secret from step 3

6. Leave a note in the app. The email arrives within seconds (check spam the first time).

## Behaviour

- Without the right `x-webhook-secret`, the function returns 403 and sends nothing.
- Missing `RESEND_API_KEY` or `FEEDBACK_NOTIFY_TO` returns 500; failures show in the
  webhook's logs (Database → Webhooks) and the function's logs.
- The note is stored either way; email is only a notification.
