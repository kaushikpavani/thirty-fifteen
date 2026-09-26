import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSessionFromUrl, signInWithProvider, signOutProvider } from './oauth';
import { getSupabase } from './supabase';
import { isSupabaseConfigured } from './config';
import { AppState, Linking } from 'react-native';
import { ensureDevice, syncProfile, track } from '../storage/cloud';
import { loadLocalName, saveLocalName } from '../storage/profile';
import type { AuthUser } from '../types';

type AuthContextValue = {
  ready: boolean;
  configured: boolean;
  user: AuthUser | null;
  localName: string | null;
  displayName: string | null;
  needsSetup: boolean;
  error: string | null;
  busy: 'google' | 'facebook' | null;
  signIn: (provider: 'google' | 'facebook') => Promise<void>;
  signOut: () => Promise<void>;
  setLocalName: (value: string) => Promise<void>;
  dismissSetup: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function firstToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const token = value.trim().split(/\s+/)[0];
  return token || null;
}

export function mapAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    firstToken(meta.full_name) ??
    firstToken(meta.name) ??
    firstToken(meta.user_name) ??
    firstToken(user.email?.split('@')[0]);
  const providerRaw = user.app_metadata?.provider;
  const provider = typeof providerRaw === 'string' ? providerRaw : 'account';
  return {
    id: user.id,
    name,
    email: user.email ?? null,
    provider,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [localName, setLocalNameState] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'google' | 'facebook' | null>(null);
  const configured = isSupabaseConfigured();
  const userRef = useRef<AuthUser | null>(null);
  const sawAuthEvent = useRef(false);
  const signedInSeen = useRef(new Set<string>());
  userRef.current = user;

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();
    void (async () => {
      const stored = await loadLocalName();
      if (cancelled) return;
      setLocalNameState(stored);
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const next = mapAuthUser(data.session?.user ?? null);
        setUser(next);
        if (next) void syncProfile(next);
      }
      setReady(true);
    })();

    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      const next = mapAuthUser(session?.user ?? null);
      setUser(next);
      const first = !sawAuthEvent.current;
      sawAuthEvent.current = true;
      if (first && next) void syncProfile(next);
      // A restored session can arrive as the first callback. That is not a new sign-in.
      if (first && event === 'SIGNED_IN') return;
      if (event === 'SIGNED_OUT') {
        signedInSeen.current.clear();
        return;
      }
      if (event === 'SIGNED_IN' && next && !signedInSeen.current.has(next.id)) {
        signedInSeen.current.add(next.id);
        void syncProfile(next);
        void track('sign_in', { provider: next.provider });
      }
    });

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      if (!url.includes('auth-callback') && !url.includes('code=') && !url.includes('access_token')) return;
      void createSessionFromUrl(url).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Sign-in failed.');
      });
    });

    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void ensureDevice();
      const current = userRef.current;
      if (current) void syncProfile(current);
    });

    return () => {
      cancelled = true;
      subscription?.data.subscription.unsubscribe();
      linkSub.remove();
      appSub.remove();
    };
  }, []);

  const signIn = useCallback(async (provider: 'google' | 'facebook') => {
    setError(null);
    if (!isSupabaseConfigured()) {
      setNeedsSetup(true);
      return;
    }
    setBusy(provider);
    try {
      await signInWithProvider(provider);
      setNeedsSetup(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(null);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await track('sign_out');
      await signOutProvider();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-out failed.');
    }
  }, []);

  const setLocalName = useCallback(async (value: string) => {
    const next = value.trim() || null;
    setLocalNameState(next);
    await saveLocalName(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured,
      user,
      localName,
      displayName: user?.name ?? localName,
      needsSetup,
      error,
      busy,
      signIn,
      signOut,
      setLocalName,
      dismissSetup: () => setNeedsSetup(false),
    }),
    [ready, configured, user, localName, needsSetup, error, busy, signIn, signOut, setLocalName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
