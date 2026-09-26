/**
 * Product analytics taxonomy. Properties stay sparse.
 * Email, names, and feedback text never go into `app_events`.
 */

export const ANALYTICS_EVENTS = [
  'app_open',
  'sign_in',
  'sign_out',
  'workout_start',
  'workout_finish',
  'feedback',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Top-level keys rejected by `app_events_properties_no_pii`. Keep this list in sync with the SQL. */
export const PII_PROPERTY_KEYS = [
  'email',
  'display_name',
  'name',
  'body',
  'rider_name',
  'full_name',
  'user_name',
] as const;

export type EventProperties = Record<string, string | number | boolean | null>;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAnalyticsEvent(name: string): name is AnalyticsEventName {
  return (ANALYTICS_EVENTS as readonly string[]).includes(name);
}

/** Drop names, note text, and email-shaped strings. Numbers and flags stay. */
export function sanitizeEventProperties(properties: EventProperties): EventProperties {
  const blocked = new Set<string>(PII_PROPERTY_KEYS);
  const next: EventProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (blocked.has(key.toLowerCase())) continue;
    if (typeof value === 'string' && EMAIL_SHAPE.test(value.trim())) continue;
    next[key] = value;
  }
  return next;
}
