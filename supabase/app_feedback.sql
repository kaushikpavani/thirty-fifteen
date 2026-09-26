-- Optional free-form notes. Run in the Supabase SQL editor.
-- Riders can insert without an account. They cannot read anyone else's notes.
-- You read them in the Table Editor (the dashboard bypasses row level security).
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  rider_name text,
  platform text,
  app_version text
);

alter table public.app_feedback enable row level security;

create policy "anyone can leave feedback"
  on public.app_feedback
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(body)) between 1 and 2000
    and (user_id is null or user_id = auth.uid())
  );

grant insert on public.app_feedback to anon, authenticated;
