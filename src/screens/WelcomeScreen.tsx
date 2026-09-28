import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BikeHero } from '../components/BikeHero';

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <BikeHero />
      <View style={[styles.copy, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 18 }]}>
        <Text style={styles.mark}>30/15</Text>
        <Text style={styles.sub}>Welcome to a smarter way to train.</Text>
        <View style={styles.flex} />
        <Pressable
          accessibilityRole="button"
          onPress={onDone}
          testID="welcome-start"
          style={({ pressed }) => [styles.go, pressed && styles.pressed]}
        >
          <Text style={styles.goLabel}>Get started</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDone} testID="welcome-skip" hitSlop={10} style={styles.skipHit}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  copy: { flex: 1, paddingHorizontal: 28 },
  mark: {
    color: '#FFFFFF',
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  sub: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '500',
    maxWidth: 260,
  },
  flex: { flex: 1 },
  go: {
    alignSelf: 'stretch',
    marginRight: 36,
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(28,28,30,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  goLabel: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  skipHit: { alignSelf: 'flex-start', marginTop: 16, paddingVertical: 6 },
  skip: { color: 'rgba(255,255,255,0.92)', fontSize: 17, fontWeight: '500' },
});
