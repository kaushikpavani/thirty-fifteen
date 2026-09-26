import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WHY_BULLETS, WHY_COMPARE, WHY_COMPARE_TITLE, WHY_HERO } from '../content/why3015';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function WhySheet({ visible, onClose }: Props) {
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetMax = Math.max(280, Math.round(height - insets.top - 28));

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'fade'}
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdropHit]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close why 30/15"
          testID="why-3015-backdrop"
        />
        <View style={[styles.card, { maxHeight: sheetMax }]} testID="why-3015-sheet">
          <View style={styles.header}>
            <Text style={styles.kicker}>WHY</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="why-3015-close"
            >
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <ScrollView
            style={{ maxHeight: sheetMax - 52 }}
            contentContainerStyle={styles.copy}
            showsVerticalScrollIndicator
            indicatorStyle="white"
          >
            <Text style={styles.hero}>{WHY_HERO}</Text>
            <View style={styles.bullets}>
              {WHY_BULLETS.map((line) => (
                <View key={line} style={styles.bulletRow}>
                  <Text style={styles.bulletMark}>•</Text>
                  <Text style={styles.bullet}>{line}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.section}>{WHY_COMPARE_TITLE}</Text>
            {WHY_COMPARE.map((paragraph) => (
              <Text key={paragraph} style={styles.body}>
                {paragraph}
              </Text>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
  },
  backdropHit: { zIndex: 0 },
  card: {
    zIndex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: 28,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 4,
  },
  kicker: {
    color: colors.textDim,
    fontWeight: '600',
    letterSpacing: 2,
    fontSize: 12,
  },
  close: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 4,
  },
  copy: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 16,
  },
  hero: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  bullets: { gap: 12 },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletMark: {
    color: colors.textDim,
    fontSize: 15,
    lineHeight: 22,
    width: 12,
  },
  bullet: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 4,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});
