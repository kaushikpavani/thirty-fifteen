import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: 'solid' | 'hairline' | 'quiet' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
};

export function PrimaryButton({
  label,
  onPress,
  onLongPress,
  variant = 'solid',
  disabled,
  loading,
  style,
  testID,
}: Props) {
  const solid = variant === 'solid';
  const danger = variant === 'danger';
  const hairline = variant === 'hairline';
  const color = solid ? colors.black : danger ? colors.hard : colors.text;

  return (
    <Pressable
      key={label}
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={550}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        solid && styles.solid,
        hairline && styles.hairline,
        danger && styles.danger,
        {
          opacity: disabled ? 0.4 : pressed ? 0.72 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.label, { color }, !solid && styles.labelQuiet]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  solid: {
    backgroundColor: colors.white,
  },
  hairline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelQuiet: {
    fontWeight: '500',
  },
});
