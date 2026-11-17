/**
 * Sharing a ride needs an account — that's how a shared card is tied back to
 * a rider rather than an anonymous PDF. Signed-out taps on Share go through
 * this prompt instead of silently doing nothing; the same copy and choices
 * everywhere a Share button appears. Start does not use this.
 */
import { signInLabel, signInProviders, type SignInProvider } from '../auth/providers';

export type SignInActions = { signIn: (provider: SignInProvider) => void };

export function shareSignInAlert(auth: SignInActions, platform: string): {
  title: string;
  message: string;
  buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[];
} {
  return {
    title: 'Sign in to share',
    message:
      platform === 'ios'
        ? 'Sign in so a shared ride card can say whose it is — then share it anywhere from your iPhone.'
        : 'Sign in so a shared ride card can say whose it is — then share it anywhere from your phone.',
    buttons: [
      { text: 'Cancel', style: 'cancel' },
      ...signInProviders(platform).map((provider) => ({
        text: signInLabel(provider, null),
        onPress: () => auth.signIn(provider),
      })),
    ],
  };
}
