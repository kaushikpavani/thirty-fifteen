# delete-account

Deletes the signed-in rider's 30/15 cloud rows, then their auth user.

Settings → Your data → **Delete account** calls this function. **Delete account and iPhone data** clears the phone first, then calls the same function. Start does not call it.

The rider's JWT is checked with the anon key. `delete_user_cloud_data` and the Auth admin delete run with the service role, which Supabase injects as `SUPABASE_SERVICE_ROLE_KEY`. That key is not in the app or this repo.

Run it on the dedicated 30/15 project only. Do not deploy it to BioAge.

## Deploy

The SQL function has to exist before the Edge Function can delete rows. From a checkout of this repo, one command at a time:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <the 30/15 project ref>
```

The ref is the subdomain of `EXPO_PUBLIC_SUPABASE_URL` (`https://<project-ref>.supabase.co`).

```bash
npx supabase db query --remote --yes -f supabase/migrations/20261116120000_delete_account_edge.sql
```

If that query command is not in your CLI, open the 30/15 SQL editor and run the file there instead. Do not run it in any other project.

```bash
npx supabase functions deploy delete-account
```

Do not pass `--no-verify-jwt`. The gateway must require a signed-in rider. The function then checks that JWT itself and ignores any user id in the body.

No extra secrets. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are already on the function.

## What it deletes

In one database call: imported activities, workout sessions, analytics events, connections, signed-in notes, the link from installs to the rider, and the profile. Then the auth user. Install rows stay, with no rider attached. Anonymous notes that were sent signed out have no user id, so they are not selected.

A second call after the user is already gone is safe: row deletes match nothing, and the admin delete treats "already gone" as finished.
