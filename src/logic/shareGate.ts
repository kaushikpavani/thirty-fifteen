/**
 * Sharing a ride needs an account — that's how a shared card is tied back to
 * a rider rather than an anonymous PDF. Signed-out taps on Share go through
 * this prompt instead of silently doing nothing; the same copy and choices
 * everywhere a Share button appears.
 */
export type SignInActions = { signIn: (provider: 'google' | 'facebook') => void };

export function shareSignInAlert(auth: SignInActions): {
  title: string;
  message: string;
  buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[];
} {
  return {
    title: 'Sign in to share',
    message: 'Sign in so a shared ride card can say whose it is — then share it anywhere from your iPhone.',
    buttons: [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue with Google', onPress: () => auth.signIn('google') },
      { text: 'Continue with Facebook', onPress: () => auth.signIn('facebook') },
    ],
  };
}
