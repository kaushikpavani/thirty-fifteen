import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createSessionFromUrl, signInWithProvider, signOutProvider } from './oauth';
import { getSupabase } from './supabase';
import { isSupabaseConfigured } from './config';
import { AppState, Linking } from 'react-native';
import { track } from '../storage/cloud';
import { onCloudAccountDeleted } from '../storage/deletion';
import { scheduleSync } from '../storage/sync';
import { loadLocalName, saveLocalName } from '../storage/profile';
import type { AuthUser } from '../types';
import { mapAuthUser } from './mapUser';
import { loadCachedAuthUser } from './sessionCache';

export { mapAuthUser };

type AuthContextValue = {
  ready: boolean;
  configured: boolean;
  user: AuthUser | null;
  localName: string | null;
  displayName: string | null;
  needsSetup: boolean;
  error: string | null;
  busy: 'google' | 'facebook' | null;
  /** True for one tick right after a genuine new sign-in (not a restored session). A screen can react once, then must call clearJustSignedIn(). */
  justSignedIn: boolean;
  clearJustSignedIn: () => void;
  signIn: (provider: 'google' | 'facebook') => Promise<void>;
  signOut: () => Promise<void>;
  /** Drop the local session after the cloud account is gone. Does not call the network. */
  signOutLocal: () => Promise<void>;
  setLocalName: (value: string) => Promise<void>;
  dismissSetup: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [localName, setLocalNameState] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'google' | 'facebook' | null>(null);
  const [justSignedIn, setJustSignedIn] = useState(false);
  const configured = isSupabaseConfigured();
  const sawAuthEvent = useRef(false);
  const signedInSeen = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();
    void (async () => {
      const stored = await loadLocalName();
      if (cancelled) return;
      setLocalNameState(stored);
      // Cached session only. Token refresh can hang with no signal, and Start must not wait.
      const cached = await loadCachedAuthUser();
      if (cancelled) return;
      if (cached) setUser(cached);
      setReady(true);
      if (!supabase) return;
      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (cancelled) return;
          setUser(mapAuthUser(data.session?.user ?? null));
        })
        .catch(() => {
          // Keep the cached rider. The ride does not need a fresh token.
        });
    })();

    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      const next = mapAuthUser(session?.user ?? null);
      setUser(next);
      const first = !sawAuthEvent.current;
      sawAuthEvent.current = true;
      scheduleSync();
      // A restored session can arrive as the first callback. That is not a new sign-in.
      if (first && event === 'SIGNED_IN') return;
      if (event === 'SIGNED_OUT') {
        signedInSeen.current.clear();
        return;
      }
      if (event === 'SIGNED_IN' && next && !signedInSeen.current.has(next.id)) {
        signedInSeen.current.add(next.id);
        void track('sign_in', { provider: next.provider });
        setJustSignedIn(true);
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
      scheduleSync();
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

  const signOutLocal = useCallback(async () => {
    setError(null);
    setUser(null);
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // The rider is already cleared in memory.
    }
  }, []);

  useEffect(() => onCloudAccountDeleted(() => signOutLocal()), [signOutLocal]);

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

  const clearJustSignedIn = useCallback(() => setJustSignedIn(false), []);

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
      justSignedIn,
      clearJustSignedIn,
      signIn,
      signOut,
      signOutLocal,
      setLocalName,
      dismissSetup: () => setNeedsSetup(false),
    }),
    [
      ready,
      configured,
      user,
      localName,
      needsSetup,
      error,
      busy,
      justSignedIn,
      clearJustSignedIn,
      signIn,
      signOut,
      signOutLocal,
      setLocalName,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
