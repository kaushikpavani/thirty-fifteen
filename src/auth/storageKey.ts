/** Same key Supabase uses for the persisted session. Reading it does not touch the network. */
export function supabaseAuthStorageKey(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const host = new URL(trimmed).hostname.split('.')[0];
    if (!host) return null;
    return `sb-${host}-auth-token`;
  } catch {
    return null;
  }
}

export type StoredSessionUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

/** User object inside the persisted session blob. Null when it is missing or unreadable. */
export function storedSessionUser(raw: string | null): StoredSessionUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { user?: { id?: unknown } | null };
    const id = parsed.user?.id;
    if (typeof id !== 'string' || !id) return null;
    const user = parsed.user as StoredSessionUser;
    return user;
  } catch {
    return null;
  }
}
