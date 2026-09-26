-- Run in the Supabase SQL editor after enabling Google and Facebook auth.
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
  created_at timestamptz not null default now()
);

alter table public.workout_sessions enable row level security;

create policy "read own sessions"
  on public.workout_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own sessions"
  on public.workout_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own sessions"
  on public.workout_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.workout_sessions to authenticated;

create index if not exists workout_sessions_user_ended
  on public.workout_sessions (user_id, ended_at desc);
