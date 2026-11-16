-- 30/15 Coach — cloud data delete for the delete-account Edge Function.
--
-- Run this on the dedicated 30/15 Supabase project after
-- 20260926160000_deletion.sql. Safe to re-run.
-- Do not use the BioAge project. Do not share a Supabase project or tables
-- with another app.
--
-- Settings → Your data calls the delete-account Edge Function. That function
-- checks the rider's JWT, calls delete_user_cloud_data with the service role,
-- then removes the auth user with the Auth admin API.
--
-- This function does not delete auth.users. A client JWT cannot be trusted
-- to pass an arbitrary id, so execute is granted to service_role only.
-- delete_my_account() remains for a SQL-editor session that already is the
-- rider. The app does not call it: if deleting auth.users is denied, that
-- whole transaction rolls back and the cloud rows stay.

create or replace function public.delete_user_cloud_data(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_uid is null then
    raise exception 'missing user';
  end if;

  delete from public.imported_activities where user_id = p_uid;
  delete from public.workout_sessions where user_id = p_uid;
  delete from public.app_events where user_id = p_uid;
  delete from public.connections where user_id = p_uid;
  delete from public.app_feedback where user_id = p_uid;
  update public.devices set user_id = null where user_id = p_uid;
  delete from public.profiles where id = p_uid;
end;
$$;

comment on function public.delete_user_cloud_data(uuid) is
  'Delete one rider''s 30/15 cloud rows and unlink their installs. Service role only. Does not remove the auth user.';

revoke all on function public.delete_user_cloud_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_user_cloud_data(uuid) to service_role;

select '30/15 account edge delete ready' as status;
