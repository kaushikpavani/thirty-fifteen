import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'orange';
  size?: 'lg' | 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function PrimaryButton({
  label,
  onPress,
  onLongPress,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  style,
}: Props) {
  const bg =
    variant === 'primary'
      ? colors.teal
      : variant === 'orange'
        ? colors.orange
        : variant === 'danger'
          ? colors.danger
          : variant === 'secondary'
            ? colors.bgCard
            : 'transparent';
  const fg =
    variant === 'ghost' || variant === 'secondary' ? colors.text : colors.bg;
  const height = size === 'lg' ? 64 : size === 'md' ? 52 : 42;
  const fontSize = size === 'lg' ? 20 : size === 'md' ? 17 : 15;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={550}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          height,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          borderWidth: variant === 'secondary' || variant === 'ghost' ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg, fontSize }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    minWidth: 120,
  },
  label: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
