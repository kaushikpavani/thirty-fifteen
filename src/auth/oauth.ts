import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { getSupabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export function authRedirectUri(): string {
  return makeRedirectUri({
    scheme: 'thirtyfifteen',
    path: 'auth-callback',
  });
}

export async function createSessionFromUrl(url: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const query = parsed.searchParams;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const errorText = query.get('error_description') ?? hash.get('error_description');
  if (errorText) throw new Error(decodeURIComponent(errorText.replace(/\+/g, ' ')));

  const code = query.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return true;
      throw error;
    }
    return true;
  }

  const accessToken = hash.get('access_token') ?? query.get('access_token');
  const refreshToken = hash.get('refresh_token') ?? query.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return true;
  }

  return false;
}

export async function signInWithProvider(provider: 'google' | 'facebook'): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const redirectTo = authRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: provider === 'facebook' ? 'email,public_profile' : 'email profile',
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('The provider did not return a sign-in URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    await createSessionFromUrl(result.url);
  }
}

export async function signOutProvider(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
