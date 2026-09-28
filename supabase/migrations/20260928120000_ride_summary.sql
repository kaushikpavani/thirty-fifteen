-- Ride summary copied from the phone after Done.
-- The phone stays the source of truth. A missing column must not block the ride.
-- Apply on the 30/15 Supabase project only.

alter table public.workout_sessions
  add column if not exists summary jsonb;

comment on column public.workout_sessions.summary is
  'Aggregates from the phone: sets, time in hard and easy, power, heart rate, and a power sparkline. Null when the ride had no sensor samples. No names or email.';
