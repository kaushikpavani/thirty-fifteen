import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from './config';

let client: SupabaseClient | null = null;
let refreshBound = false;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;
  client = createClient(supabaseUrl(), supabaseKey(), {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  if (!refreshBound) {
    refreshBound = true;
    AppState.addEventListener('change', (state) => {
      if (!client) return;
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    });
  }
  return client;
}
