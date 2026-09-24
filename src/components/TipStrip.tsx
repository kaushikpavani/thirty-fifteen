import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { TIP } from '../workout/defaults';

export function TipStrip({ text = TIP }: { text?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>TIP</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  label: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  text: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
