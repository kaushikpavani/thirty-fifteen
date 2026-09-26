import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

const native = Platform.OS !== 'web';

type Props = {
  variant?: 'ride' | 'rest';
  /** Solid phase color. The glow falls off before it reaches the type. */
  color?: string;
  paused?: boolean;
  /** Easy and rest breathe slower and a notch quieter than hard. */
  heat?: 'hot' | 'cool';
  reduceMotion?: boolean;
  /** Increments on a round won, and on the finish screen. One glow punch, then still. */
  punch?: number;
};

/**
 * Light under the hero. A radial pool breathes and crossfades with the phase.
 * The brightest part sits below the countdown so the number stays sharp.
 */
export function Atmosphere({
  variant = 'ride',
  color = '#FFD60A',
  paused = false,
  heat = 'hot',
  reduceMotion = false,
  punch = 0,
}: Props) {
  const breath = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const punchSeen = useRef<number | null>(null);
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
    const half = paused ? 5200 : variant === 'rest' ? 3000 : heat === 'cool' ? 4600 : 3200;
    const easing = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: half, easing, useNativeDriver: native }),
        Animated.timing(breath, { toValue: 0, duration: half, easing, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, heat, paused, reduceMotion, variant]);

  useEffect(() => {
    const current = front.current === 'a' ? aColor : bColor;
    if (color === current) return;
    const duration = reduceMotion ? 0 : 300;
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

  useEffect(() => {
    if (punchSeen.current === punch) return;
    const first = punchSeen.current === null;
    punchSeen.current = punch;
    if (reduceMotion || (first && punch === 0)) {
      burst.setValue(0);
      return;
    }
    burst.setValue(1);
    Animated.timing(burst, {
      toValue: 0,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [burst, punch, reduceMotion]);

  const scale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: reduceMotion || paused ? [1, 1] : [1, heat === 'cool' ? 1.05 : 1.08],
  });
  const presence = breath.interpolate({
    inputRange: [0, 1],
    outputRange: reduceMotion ? [1, 1] : paused ? [0.75, 0.75] : heat === 'cool' ? [0.8, 1] : [0.82, 1],
  });

  return (
    <View pointerEvents="none" style={styles.fill}>
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(7,7,8,0)', colors.bg] as [string, string, string]}
        locations={[0, 0.55, 1] as [number, number, number]}
        style={styles.fill}
      />
      <Animated.View style={[styles.fill, { opacity: presence, transform: [{ scale }] }]}>
        {variant === 'rest' ? (
          <RestLight />
        ) : (
          <>
            <Animated.View style={[styles.fill, { opacity: aOpacity }]} pointerEvents="none">
              <PhaseLight color={aColor} id="phase-a" heat={heat} />
            </Animated.View>
            <Animated.View style={[styles.fill, { opacity: bOpacity }]} pointerEvents="none">
              <PhaseLight color={bColor} id="phase-b" heat={heat} />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.fill,
                {
                  opacity: burst,
                  transform: [
                    {
                      scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }),
                    },
                  ],
                },
              ]}
            >
              <PhaseLight color={colors.go} id="round-won" heat="hot" />
            </Animated.View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

function PhaseLight({ color, id, heat }: { color: string; id: string; heat: 'hot' | 'cool' }) {
  const core = heat === 'cool' ? '0.5' : '0.72';
  const mid = heat === 'cool' ? '0.22' : '0.32';
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="52%" rx="78%" ry="58%">
          <Stop offset="0" stopColor={color} stopOpacity={core} />
          <Stop offset="0.45" stopColor={color} stopOpacity={mid} />
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
        <RadialGradient id="rest-warm" cx="46%" cy="40%" rx="78%" ry="56%">
          <Stop offset="0" stopColor="#FFB020" stopOpacity="0.95" />
          <Stop offset="0.42" stopColor="#FF9F0A" stopOpacity="0.42" />
          <Stop offset="1" stopColor="#FF9F0A" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="rest-cool" cx="92%" cy="62%" rx="56%" ry="42%">
          <Stop offset="0" stopColor="#64D2FF" stopOpacity="0.7" />
          <Stop offset="0.46" stopColor="#64D2FF" stopOpacity="0.26" />
          <Stop offset="1" stopColor="#64D2FF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#rest-warm)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#rest-cool)" />
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
