/**
 * Order for deleting one rider from the dedicated 30/15 project.
 * Cloud rows go first so analytics are not left behind with a null user id
 * when the auth user is removed. The auth user is last, and only the
 * delete-account Edge Function removes it, with the service role.
 */

export const CLOUD_DATA_RPC = 'delete_user_cloud_data';

/** Tables cleared by user_id, then the install unlink, then the profile. */
export const CLOUD_TABLE_DELETES = [
  'imported_activities',
  'workout_sessions',
  'app_events',
  'connections',
  'app_feedback',
] as const;

export function cloudDataDeleteOrder(): readonly string[] {
  return [...CLOUD_TABLE_DELETES, 'devices', 'profiles'];
}

export function accountDeleteOrder(): readonly string[] {
  return [...cloudDataDeleteOrder(), 'auth.users'];
}

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAccountUserId(value: string): boolean {
  return USER_ID.test(value);
}
