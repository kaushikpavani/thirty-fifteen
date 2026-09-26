-- 30/15 Coach — offline outbox ids.
--
-- Run this after 20260926120000_foundation.sql in a dedicated 30/15 Supabase
-- project. Safe to re-run. Do not use the BioAge project. Do not share a
-- Supabase project or tables with another app.
--
-- The phone is the source of truth. These columns let a later flush retry
-- without inserting the same analytics event or feedback note twice.
-- The workout does not read this database to start, keep time, speak, or play music.

alter table public.app_events add column if not exists client_event_id text;
alter table public.app_feedback add column if not exists client_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_events_client_event_id_len') then
    alter table public.app_events
      add constraint app_events_client_event_id_len
      check (client_event_id is null or client_event_id ~ '^[A-Za-z0-9_-]{8,80}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_events_client_event_id_key') then
    alter table public.app_events
      add constraint app_events_client_event_id_key unique (client_event_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_feedback_client_id_len') then
    alter table public.app_feedback
      add constraint app_feedback_client_id_len
      check (client_id is null or client_id ~ '^[A-Za-z0-9_-]{8,80}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_feedback_client_id_key') then
    alter table public.app_feedback
      add constraint app_feedback_client_id_key unique (client_id);
  end if;
end $$;

comment on column public.app_events.client_event_id is
  'Id from the phone analytics outbox. A later flush uses it so the same event is not stored twice.';
comment on column public.app_feedback.client_id is
  'Id from the phone feedback outbox. A later flush uses it so the same note is not stored twice.';

select '30/15 offline outbox ids ready' as status;
