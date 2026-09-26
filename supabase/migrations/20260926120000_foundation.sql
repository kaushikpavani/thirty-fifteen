-- 30/15 Coach — foundation schema.
--
-- Create a dedicated Supabase project for 30/15 only. Paste this entire file
-- into that project's SQL editor and run it. Safe to re-run.
--
-- Do not use the BioAge project. Do not share a Supabase project or any
-- tables with another app. This script creates 30/15 tables only.
--
-- After it succeeds, copy the project URL and publishable (anon) key into
-- .env.local as EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
-- then restart Expo. Riders can start a workout with no account. Row level
-- security is the boundary; the publishable key is public.
--
-- Owner views (SQL editor / service role, not the app key):
--   select * from public.owner_daily_active order by day desc;
--   select * from public.owner_new_profiles order by day desc;
--   select * from public.owner_workouts_completed order by day desc;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user. Client upserts on sign-in and on open.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  ftp_watts integer,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint profiles_display_name_len check (display_name is null or char_length(display_name) between 1 and 80),
  constraint profiles_ftp_range check (ftp_watts is null or ftp_watts between 50 and 600),
  constraint profiles_prefs_object check (jsonb_typeof(prefs) = 'object' and octet_length(prefs::text) <= 8000)
);

comment on table public.profiles is
  '30/15 rider. FTP is a copy of the number saved on the phone. The ride uses the on-device value.';
comment on column public.profiles.prefs is
  'Future client preferences. The app does not write this yet.';
comment on column public.profiles.last_seen_at is
  'Bumped when the signed-in app opens or returns to the foreground.';

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create index if not exists profiles_last_seen_idx
  on public.profiles (last_seen_at desc);

-- ---------------------------------------------------------------------------
-- devices — one row per install. Anonymous until a rider signs in on it.
-- ---------------------------------------------------------------------------

create table if not exists public.devices (
  id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  platform text,
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint devices_id_format check (id ~ '^[A-Za-z0-9_-]{8,80}$'),
  constraint devices_platform_len check (platform is null or char_length(platform) <= 32),
  constraint devices_app_version_len check (app_version is null or char_length(app_version) <= 32)
);

comment on table public.devices is
  'App install. Writes go through touch_device so a client cannot edit someone else''s row directly.';

alter table public.devices enable row level security;
alter table public.devices force row level security;

create index if not exists devices_user_idx on public.devices (user_id);
create index if not exists devices_last_seen_idx on public.devices (last_seen_at desc);

-- Only write path for installs. Authenticated calls claim the install for auth.uid().
-- Anonymous calls refresh last_seen and never clear an existing user_id.
create or replace function public.touch_device(
  p_id text,
  p_platform text default null,
  p_app_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_platform text := nullif(left(btrim(coalesce(p_platform, '')), 32), '');
  v_version text := nullif(left(btrim(coalesce(p_app_version, '')), 32), '');
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'invalid device id';
  end if;

  insert into public.devices (id, user_id, platform, app_version, last_seen_at)
  values (p_id, v_uid, v_platform, v_version, now())
  on conflict (id) do update
    set last_seen_at = now(),
        platform = coalesce(excluded.platform, public.devices.platform),
        app_version = coalesce(excluded.app_version, public.devices.app_version),
        user_id = case
          when v_uid is not null then v_uid
          else public.devices.user_id
        end;
end;
$$;

comment on function public.touch_device(text, text, text) is
  'Upsert this install and bump last_seen. A signed-in caller becomes user_id. Does not read other installs.';

-- ---------------------------------------------------------------------------
-- app_events — append-only analytics. No client reads.
-- ---------------------------------------------------------------------------

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_id uuid references auth.users (id) on delete set null,
  device_id text references public.devices (id) on delete set null,
  client_session_id text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint app_events_name_format check (event_name ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint app_events_client_session_format check (
    client_session_id is null or client_session_id ~ '^[A-Za-z0-9_-]{8,80}$'
  ),
  constraint app_events_properties_object check (
    jsonb_typeof(properties) = 'object' and octet_length(properties::text) <= 4000
  )
);

comment on table public.app_events is
  'Append-only 30/15 analytics. Riders can insert and cannot read. Known names: app_open, sign_in, sign_out, workout_start, workout_finish, feedback. New names need no migration when they match the name check.';

alter table public.app_events enable row level security;
alter table public.app_events force row level security;

create index if not exists app_events_created_at_idx
  on public.app_events (created_at desc);
create index if not exists app_events_name_created_idx
  on public.app_events (event_name, created_at desc);
create index if not exists app_events_user_created_idx
  on public.app_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- workout_sessions — existing history sync, plus device and a future source.
-- ---------------------------------------------------------------------------

create table if not exists public.workout_sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_ms integer not null,
  planned_duration_ms integer not null,
  ftp_watts integer not null,
  hard_watts integer not null,
  easy_watts integer not null,
  completed boolean not null,
  completion_pct integer not null,
  created_at timestamptz not null default now(),
  device_id text references public.devices (id) on delete set null,
  source text not null default 'manual',
  external_id text,
  constraint workout_sessions_source_check check (source in ('manual', 'strava', 'garmin', 'ble')),
  constraint workout_sessions_external_id_check check (
    external_id is null or char_length(btrim(external_id)) between 1 and 200
  )
);

alter table public.workout_sessions add column if not exists device_id text;
alter table public.workout_sessions add column if not exists source text;
alter table public.workout_sessions add column if not exists external_id text;

update public.workout_sessions set source = 'manual' where source is null;
alter table public.workout_sessions alter column source set default 'manual';
alter table public.workout_sessions alter column source set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workout_sessions_device_id_fkey') then
    alter table public.workout_sessions
      add constraint workout_sessions_device_id_fkey
      foreign key (device_id) references public.devices (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workout_sessions_source_check') then
    alter table public.workout_sessions
      add constraint workout_sessions_source_check
      check (source in ('manual', 'strava', 'garmin', 'ble'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workout_sessions_external_id_check') then
    alter table public.workout_sessions
      add constraint workout_sessions_external_id_check
      check (external_id is null or char_length(btrim(external_id)) between 1 and 200);
  end if;
end $$;

comment on table public.workout_sessions is
  'Finished 30/15 sessions for the signed-in rider. source defaults to manual. strava, garmin, and ble are reserved for later imports.';
comment on column public.workout_sessions.external_id is
  'Provider activity id when source is not manual. Null for sessions recorded in the app.';

alter table public.workout_sessions enable row level security;
alter table public.workout_sessions force row level security;

create index if not exists workout_sessions_user_ended
  on public.workout_sessions (user_id, ended_at desc);

create unique index if not exists workout_sessions_source_external_idx
  on public.workout_sessions (source, external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------
-- app_feedback — anonymous insert, no rider reads. device_id is optional.
-- ---------------------------------------------------------------------------

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  rider_name text,
  platform text,
  app_version text,
  device_id text references public.devices (id) on delete set null
);

alter table public.app_feedback add column if not exists device_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_feedback_device_id_fkey') then
    alter table public.app_feedback
      add constraint app_feedback_device_id_fkey
      foreign key (device_id) references public.devices (id) on delete set null;
  end if;
end $$;

comment on table public.app_feedback is
  'Free-form notes. Anonymous insert is allowed. Riders cannot select this table. Read it in the Table Editor.';

alter table public.app_feedback enable row level security;
alter table public.app_feedback force row level security;

create index if not exists app_feedback_created_idx
  on public.app_feedback (created_at desc);

-- ---------------------------------------------------------------------------
-- connections — link status only. Tokens belong in Vault via an Edge Function.
-- ---------------------------------------------------------------------------

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  status text not null default 'pending',
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connections_provider_check check (provider in ('strava', 'garmin', 'ble')),
  constraint connections_status_check check (status in ('pending', 'active', 'revoked', 'error')),
  constraint connections_user_provider_key unique (user_id, provider),
  constraint connections_metadata_object check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8000
  )
);

comment on table public.connections is
  'Provider link status for a 30/15 rider (Strava, Garmin, or a BLE meter later). Do not store raw OAuth access tokens, refresh tokens, or client secrets in this table or in metadata. Token exchange belongs in an Edge Function that writes secrets to Supabase Vault. The client cannot insert or update this table.';
comment on column public.connections.metadata is
  'Non-secret link details (athlete id, display label). A trigger rejects token-like keys.';

alter table public.connections enable row level security;
alter table public.connections force row level security;

create index if not exists connections_user_idx on public.connections (user_id);

create or replace function public.connection_metadata_has_secret(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  child jsonb;
  children jsonb[];
  entry record;
begin
  if value is null or jsonb_typeof(value) = 'null' then
    return false;
  end if;

  if jsonb_typeof(value) = 'array' then
    select coalesce(array_agg(elem), '{}'::jsonb[])
      into children
      from jsonb_array_elements(value) as elem;
    foreach child in array children loop
      if public.connection_metadata_has_secret(child) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if jsonb_typeof(value) <> 'object' then
    return false;
  end if;

  for entry in select key, item from jsonb_each(value) as pair(key, item)
  loop
    if lower(entry.key) ~ '(token|secret|password|authorization)' then
      return true;
    end if;
    if public.connection_metadata_has_secret(entry.item) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function public.reject_connection_secrets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.connection_metadata_has_secret(new.metadata) then
    raise exception 'connections.metadata must not store OAuth secrets; use an Edge Function and Supabase Vault';
  end if;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists connections_reject_secrets on public.connections;
create trigger connections_reject_secrets
  before insert or update on public.connections
  for each row execute function public.reject_connection_secrets();

drop trigger if exists connections_set_updated_at on public.connections;
create trigger connections_set_updated_at
  before update on public.connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- imported_activities — stub for a later Garmin / Strava / BLE import job.
-- ---------------------------------------------------------------------------

create table if not exists public.imported_activities (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  summary jsonb not null default '{}'::jsonb,
  workout_session_id text references public.workout_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint imported_activities_provider_check check (provider in ('strava', 'garmin', 'ble')),
  constraint imported_activities_external_id_len check (char_length(btrim(external_id)) between 1 and 200),
  constraint imported_activities_provider_external_key unique (provider, external_id),
  constraint imported_activities_summary_object check (
    jsonb_typeof(summary) = 'object' and octet_length(summary::text) <= 8000
  )
);

comment on table public.imported_activities is
  'Activities pulled from a provider later. unique(provider, external_id) matches global Strava and Garmin ids. The client cannot insert this table. Link a row to workout_sessions when it becomes a 30/15 session.';

alter table public.imported_activities enable row level security;
alter table public.imported_activities force row level security;

create index if not exists imported_activities_user_started_idx
  on public.imported_activities (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- New auth users get a profile. Existing users are backfilled below.
-- ---------------------------------------------------------------------------

create or replace function public.profile_display_name(meta jsonb, email text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    left(
      split_part(
        btrim(
          coalesce(
            meta->>'full_name',
            meta->>'name',
            meta->>'user_name',
            split_part(coalesce(email, ''), '@', 1)
          )
        ),
        ' ',
        1
      ),
      80
    ),
    ''
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, public.profile_display_name(new.raw_user_meta_data, new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select u.id, public.profile_display_name(u.raw_user_meta_data, u.email)
from auth.users as u
where not exists (
  select 1 from public.profiles as p where p.id = u.id
);

-- ---------------------------------------------------------------------------
-- Policies. Drop-and-create so a re-run picks up the checks below.
-- ---------------------------------------------------------------------------

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "read own devices" on public.devices;
create policy "read own devices"
  on public.devices
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own events" on public.app_events;
create policy "insert own events"
  on public.app_events
  for insert
  to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and (device_id is null or device_id ~ '^[A-Za-z0-9_-]{8,80}$')
    and (client_session_id is null or client_session_id ~ '^[A-Za-z0-9_-]{8,80}$')
  );

drop policy if exists "read own sessions" on public.workout_sessions;
create policy "read own sessions"
  on public.workout_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own sessions" on public.workout_sessions;
create policy "insert own sessions"
  on public.workout_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own sessions" on public.workout_sessions;
create policy "update own sessions"
  on public.workout_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "anyone can leave feedback" on public.app_feedback;
create policy "anyone can leave feedback"
  on public.app_feedback
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(body)) between 1 and 2000
    and (user_id is null or user_id = auth.uid())
  );

drop policy if exists "read own connections" on public.connections;
create policy "read own connections"
  on public.connections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "read own imports" on public.imported_activities;
create policy "read own imports"
  on public.imported_activities
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Owner analytics. security_invoker so a mistaken API grant still hits RLS
-- on the base tables (riders have no select there, so they would see nothing).
-- The SQL editor and service role bypass RLS and can read the aggregates.
-- ---------------------------------------------------------------------------

create or replace view public.owner_daily_active
with (security_invoker = true) as
select
  (created_at at time zone 'utc')::date as day,
  count(distinct device_id) filter (where event_name = 'app_open') as active_devices,
  count(distinct user_id) filter (where event_name = 'app_open' and user_id is not null) as active_riders,
  count(*) filter (where event_name = 'sign_in') as sign_ins,
  count(*) filter (where event_name = 'workout_start') as workout_starts,
  count(*) filter (where event_name = 'workout_finish') as workout_finishes,
  count(*) filter (where event_name = 'feedback') as feedback_events
from public.app_events
group by 1;

comment on view public.owner_daily_active is
  'Daily active installs, sign-ins, and workout events. Read in the SQL editor. Not granted to the app key.';

create or replace view public.owner_new_profiles
with (security_invoker = true) as
select
  (created_at at time zone 'utc')::date as day,
  count(*) as new_profiles
from public.profiles
group by 1;

comment on view public.owner_new_profiles is
  'New rider profiles per UTC day. Read in the SQL editor. Not granted to the app key.';

create or replace view public.owner_workouts_completed
with (security_invoker = true) as
select
  (ended_at at time zone 'utc')::date as day,
  count(*) filter (where completed) as completed,
  count(*) as sessions
from public.workout_sessions
group by 1;

comment on view public.owner_workouts_completed is
  'Finished sessions per UTC day, and how many ran the full plan. Read in the SQL editor. Not granted to the app key.';

-- ---------------------------------------------------------------------------
-- Grants. Default privileges in Supabase hand new tables to anon. Take that
-- back, then grant only what the app needs. service_role keeps full access
-- for the dashboard and a later Edge Function.
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.devices from public, anon, authenticated;
revoke all on table public.app_events from public, anon, authenticated;
revoke all on table public.workout_sessions from public, anon, authenticated;
revoke all on table public.app_feedback from public, anon, authenticated;
revoke all on table public.connections from public, anon, authenticated;
revoke all on table public.imported_activities from public, anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select on table public.devices to authenticated;
grant insert on table public.app_events to anon, authenticated;
grant select, insert, update on table public.workout_sessions to authenticated;
grant insert on table public.app_feedback to anon, authenticated;
grant select on table public.connections to authenticated;
grant select on table public.imported_activities to authenticated;

grant all on table
  public.profiles,
  public.devices,
  public.app_events,
  public.workout_sessions,
  public.app_feedback,
  public.connections,
  public.imported_activities
to service_role;

revoke all on table public.owner_daily_active from public, anon, authenticated;
revoke all on table public.owner_new_profiles from public, anon, authenticated;
revoke all on table public.owner_workouts_completed from public, anon, authenticated;
grant select on table public.owner_daily_active to service_role;
grant select on table public.owner_new_profiles to service_role;
grant select on table public.owner_workouts_completed to service_role;

revoke all on function public.touch_device(text, text, text) from public, anon, authenticated;
grant execute on function public.touch_device(text, text, text) to anon, authenticated, service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.profile_display_name(jsonb, text) from public, anon, authenticated;
revoke all on function public.connection_metadata_has_secret(jsonb) from public, anon, authenticated;
revoke all on function public.reject_connection_secrets() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Auth inserts run as supabase_auth_admin. The trigger function must stay executable
-- by that role after we take EXECUTE away from PUBLIC. Dashboard writes use service_role.
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant execute on function public.profile_display_name(jsonb, text) to supabase_auth_admin;
grant execute on function public.reject_connection_secrets() to service_role;
grant execute on function public.set_updated_at() to service_role;
grant execute on function public.connection_metadata_has_secret(jsonb) to service_role;

select '30/15 foundation ready' as status;
