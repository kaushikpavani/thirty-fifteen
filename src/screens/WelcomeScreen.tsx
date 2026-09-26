import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AuthSetupNote } from '../components/AuthSetupNote';
import { FadeIn } from '../components/FadeIn';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useAuth } from '../auth/AuthContext';
import { greeting, motivationLine } from '../copy/motivation';
import { useHistory } from '../state/HistoryContext';
import { colors } from '../theme/colors';

export function WelcomeScreen() {
  const auth = useAuth();
  const history = useHistory();
  const [draft, setDraft] = useState(auth.localName ?? '');
  const now = new Date();
  const hello = greeting(now);
  const line = motivationLine(now, history.streak);
  const typed = draft.trim();
  const name = auth.user?.name ?? (typed || null);

  const go = async () => {
    if (!auth.user) await auth.setLocalName(draft);
    router.replace('/home');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <FadeIn>
          <Text style={styles.brand}>30/15</Text>
        </FadeIn>

        <View style={styles.hero}>
          <FadeIn delay={60}>
            <Text style={styles.hello}>
              {hello}
              {name ? ',' : ''}
            </Text>
            {name ? <Text style={styles.name}>{name}.</Text> : null}
          </FadeIn>
          <FadeIn delay={140}>
            <Text style={styles.line}>{line}</Text>
          </FadeIn>
        </View>

        <FadeIn delay={220} style={styles.actions}>
          <PrimaryButton label="Continue" onPress={() => void go()} testID="continue" />

          {auth.user ? (
            <Text style={styles.signed}>
              Signed in · {auth.user.provider}
              {auth.user.email ? ` · ${auth.user.email}` : ''}
            </Text>
          ) : (
            <View style={styles.authBlock}>
              <PrimaryButton
                variant="hairline"
                label={auth.busy === 'google' ? 'Opening…' : 'Continue with Google'}
                onPress={() => void auth.signIn('google')}
                disabled={auth.busy != null}
                testID="google-sign-in"
              />
              <PrimaryButton
                variant="hairline"
                label={auth.busy === 'facebook' ? 'Opening…' : 'Continue with Facebook'}
                onPress={() => void auth.signIn('facebook')}
                disabled={auth.busy != null}
                testID="facebook-sign-in"
              />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onEndEditing={() => {
                  void auth.setLocalName(draft);
                }}
                placeholder="Your name"
                placeholderTextColor={colors.textDim}
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.nameInput}
                testID="rider-name"
              />
            </View>
          )}

          {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}
          {auth.needsSetup ? (
            <View>
              <AuthSetupNote />
              <Pressable onPress={auth.dismissSetup} style={styles.dismiss}>
                <Text style={styles.dismissText}>Close</Text>
              </Pressable>
            </View>
          ) : null}
        </FadeIn>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  brand: {
    marginTop: 12,
    color: colors.textDim,
    letterSpacing: 3,
    fontSize: 13,
    fontWeight: '600',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 22,
  },
  hello: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: '400',
  },
  name: {
    color: colors.text,
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '200',
    letterSpacing: -1.2,
    marginTop: 4,
  },
  line: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '400',
    maxWidth: 320,
  },
  actions: { gap: 12 },
  authBlock: { gap: 10, marginTop: 4 },
  signed: {
    textAlign: 'center',
    color: colors.textDim,
    fontSize: 13,
    marginTop: 4,
  },
  nameInput: {
    color: colors.text,
    fontSize: 17,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  dismiss: { alignItems: 'center', paddingVertical: 12 },
  dismissText: { color: colors.textMuted, fontSize: 15 },
});
