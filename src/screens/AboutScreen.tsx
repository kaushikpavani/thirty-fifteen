import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { SCIENCE_BLURB } from '../workout/defaults';

type Props = { onBack: () => void };

export function AboutScreen({ onBack }: Props) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.kicker}>SCIENCE</Text>
          <Text style={styles.title}>Rønnestad 30/15</Text>
          <Text style={styles.body}>{SCIENCE_BLURB}</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Why it works</Text>
            <Text style={styles.body}>
              Short 15-second recoveries prevent full recovery, so subsequent
              hard efforts start from an elevated physiological state. Over a
              set of 13 reps you accumulate a lot of time near VO₂max without
              the same fatigue crash as long intervals.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>How to ride it</Text>
            <Text style={styles.body}>
              Hit ~120% FTP on the 30s — controlled aggression, not a sprint.
              On the 15s keep light pressure; don't coast. Save the deepest
              digs for later reps.
            </Text>
          </View>
          <Text style={styles.foot}>
            This app is a coaching timer. It is not medical advice. Train
            within your limits.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  back: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backText: { color: colors.teal, fontSize: 16, fontWeight: '700' },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  kicker: {
    color: colors.orange,
    fontWeight: '800',
    letterSpacing: 1.4,
    fontSize: 12,
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '900' },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  foot: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
});
