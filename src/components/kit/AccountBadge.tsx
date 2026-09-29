import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ink } from '../../theme/tokens';
import { tapHaptic } from './Pill';

/** "Kaushik Pavani" -> "KP". A bare email keeps its first letter only. */
export function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  const one = words[0]!;
  const alpha = one.replace(/[^a-zA-Z]/g, '');
  return (alpha.slice(0, 2) || one.slice(0, 1)).toUpperCase();
}

/**
 * The only always-visible sign of "you are signed in." Shows nothing when
 * signed out — a placeholder circle would just be one more thing on the
 * screen with nothing to say. Tapping it goes to the account row in Settings.
 */
export function AccountBadge({ name, size = 34, testID }: { name: string; size?: number; testID?: string }) {
  const initials = initialsFor(name);
  if (!initials) return null;
  return (
    <Pressable
      onPress={() => {
        tapHaptic('light');
        router.push('/settings');
      }}
      testID={testID ?? 'account-badge'}
      accessibilityRole="button"
      accessibilityLabel={`Signed in as ${name}`}
      hitSlop={6}
      style={({ pressed }) => [
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, { fontSize: Math.round(size * 0.38) }]}>{initials}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: ink.emberSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  text: { color: ink.emberText, fontWeight: '700', letterSpacing: 0.2 },
});
