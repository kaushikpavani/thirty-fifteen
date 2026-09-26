import React, { useEffect, useRef } from 'react';
import { Animated, Platform, ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
};

export function FadeIn({ children, delay = 0, style }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const native = Platform.OS !== 'web';
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        delay,
        useNativeDriver: native,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        speed: 14,
        bounciness: 0,
        useNativeDriver: native,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>{children}</Animated.View>
  );
}
