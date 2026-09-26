import type { User } from '@supabase/supabase-js';
import type { AuthUser } from '../types';

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
