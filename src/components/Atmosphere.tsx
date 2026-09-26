import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const native = Platform.OS !== 'web';
const BREATH_MS = 4000;

type Props = {
  variant?: 'ride' | 'rest';
  /** Phase color. The wash stays behind the countdown, about 8–12% at its brightest. */
  color?: string;
  paused?: boolean;
  reduceMotion?: boolean;
};

/**
 * Near-black field with one soft radial. It breathes on opacity only.
 * Phase color crossfades. It does not follow audio or watts.
 */
export function Atmosphere({
  variant = 'ride',
  color = '#FFD60A',
  paused = false,
  reduceMotion = false,
}: Props) {
  const breath = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const aOpacity = useRef(new Animated.Value(1)).current;
  const bOpacity = useRef(new Animated.Value(0)).current;
  const [aColor, setAColor] = useState(color);
  const [bColor, setBColor] = useState(color);
  const front = useRef<'a' | 'b'>('a');

  useEffect(() => {
    if (reduceMotion) {
      breath.setValue(1);
      return;
    }
    const easing = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: BREATH_MS, easing, useNativeDriver: native }),
        Animated.timing(breath, { toValue: 0, duration: BREATH_MS, easing, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, reduceMotion]);

  useEffect(() => {
    const current = front.current === 'a' ? aColor : bColor;
    if (color === current) return;
    const duration = reduceMotion ? 0 : 360;
    if (front.current === 'a') {
      setBColor(color);
      front.current = 'b';
      Animated.parallel([
        Animated.timing(bOpacity, { toValue: 1, duration, useNativeDriver: native }),
        Animated.timing(aOpacity, { toValue: 0, duration, useNativeDriver: native }),
      ]).start();
    } else {
      setAColor(color);
      front.current = 'a';
      Animated.parallel([
        Animated.timing(aOpacity, { toValue: 1, duration, useNativeDriver: native }),
        Animated.timing(bOpacity, { toValue: 0, duration, useNativeDriver: native }),
      ]).start();
    }
  }, [aColor, aOpacity, bColor, bOpacity, color, reduceMotion]);

  const presence = breath.interpolate({
    inputRange: [0, 1],
    outputRange: reduceMotion ? [1, 1] : paused ? [0.7, 0.7] : [0.72, 1],
  });

  return (
    <View pointerEvents="none" style={styles.fill}>
      <Animated.View style={[styles.fill, { opacity: presence }]}>
        {variant === 'rest' ? (
          <RestLight />
        ) : (
          <>
            <Animated.View style={[styles.fill, { opacity: aOpacity }]} pointerEvents="none">
              <PhaseLight color={aColor} id="phase-a" />
            </Animated.View>
            <Animated.View style={[styles.fill, { opacity: bOpacity }]} pointerEvents="none">
              <PhaseLight color={bColor} id="phase-b" />
            </Animated.View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

function PhaseLight({ color, id }: { color: string; id: string }) {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="46%" rx="62%" ry="42%">
          <Stop offset="0" stopColor={color} stopOpacity="0.12" />
          <Stop offset="0.55" stopColor={color} stopOpacity="0.05" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function RestLight() {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id="rest-warm" cx="50%" cy="38%" rx="58%" ry="40%">
          <Stop offset="0" stopColor="#FFB020" stopOpacity="0.14" />
          <Stop offset="0.5" stopColor="#FF9F0A" stopOpacity="0.05" />
          <Stop offset="1" stopColor="#FF9F0A" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#rest-warm)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
