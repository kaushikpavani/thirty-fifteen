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

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseKey());
}
