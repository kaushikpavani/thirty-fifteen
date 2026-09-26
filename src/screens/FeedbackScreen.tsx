import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useAuth } from '../auth/AuthContext';
import { FEEDBACK_MAX, normalizeFeedback } from '../feedback/message';
import { submitFeedback, type FeedbackDelivery } from '../storage/feedback';
import { colors } from '../theme/colors';

export function FeedbackScreen() {
  const auth = useAuth();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [delivery, setDelivery] = useState<FeedbackDelivery | null>(null);
  const body = normalizeFeedback(draft);

  const send = async () => {
    if (!body || busy) return;
    setBusy(true);
    const result = await submitFeedback({
      body,
      userId: auth.user?.id ?? null,
      riderName: auth.displayName,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version ?? null,
    });
    setDelivery(result);
    setDraft('');
    setBusy(false);
  };

  return (
    <Screen bottom>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="feedback-back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.kicker}>OPTIONAL</Text>
        <Text style={styles.title}>Feedback</Text>
        <Text style={styles.lead}>Say the good, the bad, or the thing you want. No score. No account.</Text>
      </View>

      {delivery ? (
        <View style={styles.done} testID="feedback-status">
          <Text style={styles.doneTitle}>{delivery === 'sent' ? 'Got it.' : 'Saved on this phone.'}</Text>
          <Text style={styles.lead}>
            {delivery === 'sent'
              ? 'I will read it.'
              : 'It sends the next time this app can reach the server.'}
          </Text>
          <PrimaryButton variant="quiet" label="Write another" onPress={() => setDelivery(null)} testID="feedback-again" />
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="You suck. Or I want X, Y, and Z."
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={FEEDBACK_MAX}
            textAlignVertical="top"
            style={styles.input}
            testID="feedback-input"
          />
          <PrimaryButton
            label="Send"
            onPress={() => void send()}
            disabled={!body}
            loading={busy}
            testID="send-feedback"
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 28, paddingTop: 8, gap: 12 },
  back: { color: colors.textMuted, fontSize: 16 },
  kicker: {
    marginTop: 18,
    color: colors.textDim,
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '200',
    letterSpacing: -0.8,
  },
  lead: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  form: { flex: 1, paddingHorizontal: 28, paddingTop: 28, gap: 20 },
  input: {
    minHeight: 180,
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    padding: 0,
  },
  done: { paddingHorizontal: 28, paddingTop: 36, gap: 16 },
  doneTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.4,
  },
});
