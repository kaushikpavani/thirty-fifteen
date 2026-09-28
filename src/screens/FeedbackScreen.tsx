import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { LargeTitle, NavBack } from '../components/kit/Grouped';
import { Pill } from '../components/kit/Pill';
import { Screen } from '../components/Screen';
import { useAuth } from '../auth/AuthContext';
import { FEEDBACK_MAX, normalizeFeedback } from '../feedback/message';
import { submitFeedback, type FeedbackDelivery } from '../storage/feedback';
import { ink, radius, type } from '../theme/tokens';

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
      <NavBack label="Settings" testID="feedback-back" />
      <LargeTitle>Leave a note</LargeTitle>
      <Text style={[styles.lead, styles.pad]}>Say the good, the bad, or the thing you want. No score. No account.</Text>

      {delivery ? (
        <View style={styles.done} testID="feedback-status">
          <Text style={styles.doneTitle}>{delivery === 'sent' ? 'Got it.' : 'Saved on this phone.'}</Text>
          <Text style={styles.lead}>
            {delivery === 'sent'
              ? 'I will read it.'
              : 'It sends the next time this app can reach the server.'}
          </Text>
          <Pill variant="glass" label="Write another" onPress={() => setDelivery(null)} testID="feedback-again" />
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="You suck. Or I want X, Y, and Z."
            placeholderTextColor={ink.tertiary}
            multiline
            maxLength={FEEDBACK_MAX}
            textAlignVertical="top"
            style={styles.input}
            testID="feedback-input"
          />
          {busy ? (
            <ActivityIndicator color={ink.ember} />
          ) : (
            <Pill label="Send" onPress={() => void send()} disabled={!body} testID="send-feedback" />
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, marginTop: 8 },
  lead: { color: ink.secondary, ...type.callout },
  form: { flex: 1, paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  input: {
    minHeight: 200,
    color: ink.text,
    fontSize: 17,
    lineHeight: 24,
    padding: 16,
    backgroundColor: ink.grouped,
    borderRadius: radius.group,
  },
  done: { paddingHorizontal: 20, paddingTop: 36, gap: 16 },
  doneTitle: { color: ink.text, ...type.title },
});
