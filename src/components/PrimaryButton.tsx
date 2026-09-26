import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

const native = Platform.OS !== 'web';

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
  const scale = useRef(new Animated.Value(1)).current;

  const settle = (to: number) => {
    Animated.spring(scale, { toValue: to, useNativeDriver: native, speed: 48, bounciness: 0 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        key={label}
        accessibilityRole="button"
        testID={testID}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => {
          if (!disabled && !loading) settle(0.97);
        }}
        onPressOut={() => settle(1)}
        delayLongPress={550}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.base,
          solid && styles.solid,
          hairline && styles.hairline,
          danger && styles.danger,
          {
            opacity: disabled ? 0.4 : pressed ? 0.92 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={color} />
        ) : (
          <Text style={[styles.label, { color }, !solid && styles.labelQuiet]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
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
