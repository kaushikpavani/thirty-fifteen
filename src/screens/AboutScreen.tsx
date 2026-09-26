import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';
import { SCIENCE_BLURB } from '../workout/defaults';

export function AboutScreen() {
  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.backWrap}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>SCIENCE</Text>
        <Text style={styles.title}>Rønnestad 30/15</Text>
        <Text style={styles.body}>{SCIENCE_BLURB}</Text>
        <Text style={styles.cardTitle}>Why it works</Text>
        <Text style={styles.body}>
          Fifteen seconds is not enough to recover. The next hard effort starts already elevated.
          Thirteen of those and you have stacked time near VO₂max without the crash of a long interval.
        </Text>
        <Text style={styles.cardTitle}>How to ride it</Text>
        <Text style={styles.body}>
          120% FTP on the 30s. Controlled, not a sprint. On the 15s keep light pressure. Do not coast.
          Save the deepest digs for the last reps.
        </Text>
        <Text style={styles.foot}>A coaching timer. Not medical advice. Ride within your limits.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backWrap: { paddingHorizontal: 28, paddingTop: 8 },
  back: { color: colors.textMuted, fontSize: 16 },
  scroll: { paddingHorizontal: 28, paddingBottom: 48, gap: 14 },
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
  cardTitle: {
    marginTop: 10,
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
  },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  foot: { color: colors.textDim, fontSize: 13, lineHeight: 18, marginTop: 8 },
});
