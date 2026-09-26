-- 30/15 Coach — rider deletion and privacy.
--
-- Run this after 20260926120000_foundation.sql and
-- 20260926143000_offline_outbox.sql in a dedicated 30/15 Supabase project.
-- Safe to re-run. Do not use the BioAge project. Do not share a Supabase
-- project or tables with another app.
--
-- The phone is the source of truth. These functions delete the cloud copy
-- when a signed-in rider asks. A ride does not call them to start, keep time,
-- speak, or play music.
--
-- delete_my_account() order (one transaction):
--   imported_activities, workout_sessions, app_events for this user,
--   connections, app_feedback for this user, unlink devices (user_id null),
--   profiles, then auth.users.
-- Explicit deletes run before auth.users so analytics and notes are removed,
-- not left behind with a null user_id. Devices stay as anonymous installs.
-- auth.users ON DELETE CASCADE also removes profiles, sessions, connections,
-- and imports if a dashboard delete is used instead. Tokens are not stored
-- in client-readable tables, so there is nothing to scrub in Vault here.

-- Sparse analytics only. Reject names, email, and note bodies if a client sends them.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_events_properties_no_pii') then
    alter table public.app_events
      add constraint app_events_properties_no_pii
      check (
        not (
          properties ?| array[
            'email',
            'display_name',
            'name',
            'body',
            'rider_name',
            'full_name',
            'user_name'
          ]
        )
      );
  end if;
end $$;

comment on column public.app_events.properties is
  'Sparse facts only: counts, watts, duration, provider, platform, delivery. Never email, display name, or feedback body.';

-- ---------------------------------------------------------------------------
-- Own-row deletes. The app prefers the RPCs below. Policies cover Table API
-- deletes of the signed-in rider's rows. Anonymous feedback has no user_id,
-- so the rider cannot reclaim it.
-- ---------------------------------------------------------------------------

drop policy if exists "delete own profile" on public.profiles;
create policy "delete own profile"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id);

drop policy if exists "delete own sessions" on public.workout_sessions;
create policy "delete own sessions"
  on public.workout_sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "delete own events" on public.app_events;
create policy "delete own events"
  on public.app_events
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "delete own feedback" on public.app_feedback;
create policy "delete own feedback"
  on public.app_feedback
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "delete own connections" on public.connections;
create policy "delete own connections"
  on public.connections
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "delete own imports" on public.imported_activities;
create policy "delete own imports"
  on public.imported_activities
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "delete own devices" on public.devices;
create policy "delete own devices"
  on public.devices
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant delete on table public.profiles to authenticated;
grant delete on table public.workout_sessions to authenticated;
grant delete on table public.app_events to authenticated;
grant delete on table public.app_feedback to authenticated;
grant delete on table public.connections to authenticated;
grant delete on table public.imported_activities to authenticated;
grant delete on table public.devices to authenticated;

-- Sessions ended at or before the phone's wipe. Newer rides stay.
create or replace function public.delete_my_sessions(p_ended_before timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_ended_before is null then
    raise exception 'missing cutoff';
  end if;
  delete from public.workout_sessions
  where user_id = v_uid
    and ended_at <= p_ended_before;
end;
$$;

comment on function public.delete_my_sessions(timestamptz) is
  'Delete the signed-in rider''s sessions that ended at or before the phone''s history wipe. Idempotent.';

-- Removes this install when it is anonymous or belongs to the caller.
create or replace function public.delete_my_device(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'invalid device id';
  end if;
  delete from public.devices
  where id = p_id
    and (user_id is null or user_id = auth.uid());
end;
$$;

comment on function public.delete_my_device(text) is
  'Delete one install row the caller is allowed to erase. Other riders'' devices stay.';

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  delete from public.imported_activities where user_id = v_uid;
  delete from public.workout_sessions where user_id = v_uid;
  delete from public.app_events where user_id = v_uid;
  delete from public.connections where user_id = v_uid;
  delete from public.app_feedback where user_id = v_uid;
  update public.devices set user_id = null where user_id = v_uid;
  delete from public.profiles where id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

comment on function public.delete_my_account() is
  'Delete this rider''s 30/15 cloud data, unlink devices, and remove the auth user. One transaction. Does not touch another install''s local storage.';

revoke all on function public.delete_my_sessions(timestamptz) from public, anon, authenticated;
revoke all on function public.delete_my_device(text) from public, anon, authenticated;
revoke all on function public.delete_my_account() from public, anon, authenticated;

grant execute on function public.delete_my_sessions(timestamptz) to authenticated, service_role;
grant execute on function public.delete_my_device(text) to anon, authenticated, service_role;
grant execute on function public.delete_my_account() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Owner: feedback volume per day. Not granted to the app key.
-- ---------------------------------------------------------------------------

create or replace view public.owner_feedback_daily
with (security_invoker = true) as
select
  (created_at at time zone 'utc')::date as day,
  count(*) as notes
from public.app_feedback
group by 1;

comment on view public.owner_feedback_daily is
  'Feedback notes per UTC day. Read in the SQL editor. Not granted to the app key.';

revoke all on table public.owner_feedback_daily from public, anon, authenticated;
grant select on table public.owner_feedback_daily to service_role;

select '30/15 deletion ready' as status;
