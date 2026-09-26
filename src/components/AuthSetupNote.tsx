import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { authRedirectUri } from '../auth/oauth';
import { colors } from '../theme/colors';

export function AuthSetupNote() {
  const redirect = authRedirectUri();
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Sign-in needs Supabase</Text>
      <Text style={styles.body}>
        Google and Facebook run through Supabase so Expo Go can finish in the browser. Put these in
        .env.local and restart:
      </Text>
      <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_URL{'\n'}EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY</Text>
      <Text style={styles.body}>
        Enable both providers in the Supabase dashboard. Allow this redirect, plus
        thirtyfifteen://auth-callback for a dev build.
      </Text>
      <Text selectable style={styles.uri}>
        {redirect}
      </Text>
      <Text style={styles.body}>Until then, ride locally. Your name and sessions stay on this phone.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 8,
    paddingTop: 16,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  code: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  uri: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
