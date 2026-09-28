import { useState } from 'react';
import { Animated } from 'react-native';

/**
 * One stable Animated.Value per component. React Native ships this hook, but
 * react-native-web does not, and `useRef(new Animated.Value()).current` reads a
 * ref during render. A lazy useState initializer is stable, cheap and safe.
 */
export function useAnimatedValue(initial: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}
