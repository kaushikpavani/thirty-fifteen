import React from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import * as Haptics from 'expo-haptics';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { ink, motion } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';

const native = Platform.OS !== 'web';

export function tapHaptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (Platform.OS === 'web') return;
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  };
  void Haptics.impactAsync(map[style]).catch(() => undefined);
}

/** Press-in shrink on a soft spring. Shared by every big control. */
export function usePressScale() {
  const reduce = useReduceMotion();
  const scale = useAnimatedValue(1);
  const to = (value: number) => {
    if (reduce) return;
    Animated.spring(scale, { toValue: value, useNativeDriver: native, speed: 40, bounciness: value === 1 ? 6 : 0 }).start();
  };
  return { scale, pressIn: () => to(motion.pressScale), pressOut: () => to(1) };
}

type Variant = 'ember' | 'light' | 'glass' | 'quiet';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  height?: number;
  style?: ViewStyle;
  testID?: string;
  disabled?: boolean;
  accessibilityHint?: string;
};

/** The one big rounded button. Ember for Start and Resume, light for Get started and Done. */
export function Pill({ label, onPress, variant = 'ember', icon, height = 64, style, testID, disabled, accessibilityHint }: Props) {
  const { scale, pressIn, pressOut } = usePressScale();
  const fg = variant === 'ember' || variant === 'light' ? '#000000' : ink.text;
  return (
    <Animated.View style={[{ transform: [{ scale }], borderRadius: height / 2 }, variant === 'ember' && styles.emberShadow, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        testID={testID}
        disabled={disabled}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => {
          tapHaptic(variant === 'ember' ? 'medium' : 'light');
          onPress();
        }}
        style={[styles.base, { height, borderRadius: height / 2 }, styles[variant], disabled && styles.disabled]}
      >
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ember: { backgroundColor: ink.ember },
  light: { backgroundColor: ink.text },
  glass: { backgroundColor: 'rgba(255,255,255,0.12)' },
  quiet: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.4 },
  label: { fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
  emberShadow: {
    shadowColor: ink.ember,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
});
