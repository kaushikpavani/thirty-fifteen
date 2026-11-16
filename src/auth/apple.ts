import * as AppleAuthentication from 'expo-apple-authentication';
import { appleFullName, appleIdTokenCredentials, isAppleCancel } from './providers';
import { getSupabase } from './supabase';

export class AppleSignInError extends Error {
  readonly canceled: boolean;

  constructor(message: string, canceled = false) {
    super(message);
    this.name = 'AppleSignInError';
    this.canceled = canceled;
  }
}

/**
 * Native Sign in with Apple, then Supabase `signInWithIdToken`.
 * Apple sends the person's name only on the first grant, so it is saved then.
 * Canceling the sheet does not surface an error.
 */
export async function signInWithApple(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new AppleSignInError('Supabase is not configured.');

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error) {
    if (isAppleCancel(error)) throw new AppleSignInError('canceled', true);
    const message = error instanceof Error ? error.message : 'Sign in with Apple failed.';
    throw new AppleSignInError(message);
  }

  const credentials = appleIdTokenCredentials(credential.identityToken ?? '');
  if (!credentials) throw new AppleSignInError('Apple did not return an identity token.');

  const { error } = await supabase.auth.signInWithIdToken(credentials);
  if (error) throw new AppleSignInError(error.message);

  const name = appleFullName(credential.fullName);
  if (!name) return;
  // The session already exists. Apple only sends the name once; a failed save can be edited later.
  await supabase.auth.updateUser({ data: { full_name: name, name } });
}
