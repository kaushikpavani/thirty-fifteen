/**
 * Which sign-in buttons the rider sees, and how an Apple identity token
 * becomes a Supabase session. Start does not call this module.
 */

export type SignInProvider = 'apple' | 'google';

/** Apple first on iOS so it is at least as prominent as Google (guideline 4.8). */
export function signInProviders(platform: string): SignInProvider[] {
  if (platform === 'ios') return ['apple', 'google'];
  return ['google'];
}

export function signInLabel(provider: SignInProvider, busy: SignInProvider | null): string {
  if (busy === provider) return 'Opening…';
  return provider === 'apple' ? 'Continue with Apple' : 'Continue with Google';
}

export function providerLabel(provider: string): string {
  if (provider === 'apple') return 'Apple';
  if (provider === 'google') return 'Google';
  if (provider === 'facebook') return 'Facebook';
  return provider;
}

/** Apple's native sheet uses this code when the rider dismisses it. That is not a failure. */
export function isAppleCancel(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED';
}

export function appleFullName(
  fullName:
    | {
        givenName?: string | null;
        middleName?: string | null;
        familyName?: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.middleName, fullName.familyName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(' ') : null;
}

/** Native Sign in with Apple. The token audience is the iOS bundle id. */
export function appleIdTokenCredentials(token: string): { provider: 'apple'; token: string } | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  return { provider: 'apple', token: trimmed };
}
