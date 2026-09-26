import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/colors';

const native = Platform.OS !== 'web';

type Props = {
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: 'solid' | 'hairline' | 'quiet' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  /** Slow idle breath. Home Start only — not a bait pulse. */
  alive?: boolean;
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
  alive = false,
  style,
  testID,
}: Props) {
  const reduce = useReduceMotion();
  const solid = variant === 'solid';
  const danger = variant === 'danger';
  const hairline = variant === 'hairline';
  const color = solid ? colors.black : danger ? colors.hard : colors.text;
  const scale = useRef(new Animated.Value(1)).current;
  const pressing = useRef(false);
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const stopBreath = () => {
    loopRef.current?.stop();
    loopRef.current = null;
  };

  const startBreath = () => {
    if (!alive || reduce || pressing.current) return;
    stopBreath();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.02,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: native,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: native,
        }),
      ]),
    );
    loopRef.current = loop;
    loop.start();
  };

  useEffect(() => {
    startBreath();
    return stopBreath;
    // startBreath closes over the latest alive/reduce flags via this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alive, reduce]);

  const settle = (to: number, then?: () => void) => {
    if (reduce) {
      scale.setValue(1);
      then?.();
      return;
    }
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: native,
      speed: 24,
      bounciness: 0,
    }).start(({ finished }) => {
      if (finished) then?.();
    });
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
          if (disabled || loading) return;
          pressing.current = true;
          stopBreath();
          settle(0.96);
        }}
        onPressOut={() => {
          pressing.current = false;
          settle(1, startBreath);
        }}
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
    backgroundColor: colors.go,
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
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelQuiet: {
    fontWeight: '500',
  },
});
