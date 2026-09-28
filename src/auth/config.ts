/**
 * Expo inlines EXPO_PUBLIC_* only for static `process.env.NAME` reads.
 * A dynamic `process.env[name]` is undefined in release builds, so each read is spelled out.
 */
function clean(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function supabaseUrl(): string {
  return clean(process.env.EXPO_PUBLIC_SUPABASE_URL);
}

export function supabaseKey(): string {
  return clean(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) || clean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}

/** True when both a project URL and a publishable key are present. Blank means fully local. */
export function hasCloudConfig(url: string, key: string): boolean {
  return Boolean(url.trim() && key.trim());
}

export function isSupabaseConfigured(): boolean {
  return hasCloudConfig(supabaseUrl(), supabaseKey());
}
