function readEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function supabaseUrl(): string {
  return readEnv('EXPO_PUBLIC_SUPABASE_URL');
}

export function supabaseKey(): string {
  return readEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

/** True when both a project URL and a publishable key are present. Blank means fully local. */
export function hasCloudConfig(url: string, key: string): boolean {
  return Boolean(url.trim() && key.trim());
}

export function isSupabaseConfigured(): boolean {
  return hasCloudConfig(supabaseUrl(), supabaseKey());
}
