import { Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { motion } from '../../theme/tokens';

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
