import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import {
  HOME_HEAT,
  ROAD_STREAKS,
  ROAD_WASH_OPACITY,
  asphaltSpecks,
  fieldPaint,
  type FieldPaint,
} from '../workout/heat';

const native = Platform.OS !== 'web';

type Props = {
  variant?: 'ride' | 'rest';
  /** Phase color. Painted across the field, under the digits. */
  color?: string;
  paused?: boolean;
  /** Easy and rest breathe slower and a notch quieter than hard. */
  heat?: 'hot' | 'cool';
  reduceMotion?: boolean;
  /** One glow, then still. Finish passes 1. */
  punch?: number;
  /** How long the finish bloom lasts. */
  bloomMs?: number;
  /** 2 is the double-pulse finish. Then still. */
  pulses?: 1 | 2;
  /** No breath. The bloom plays once and the light stays put. */
  still?: boolean;
  /** HARD set nudge. 1 is the locked level. */
  intensity?: number;
  /**
   * HARD bed only. Amplitude of the paint. The countdown is not wired to this.
   */
  pulse?: boolean;
  /** One beat of the drive bed, in ms. Ignored unless pulse is on. */
  beatMs?: number;
  /** Abstract road under the digits. Capped at 15% so the clock stays clear. */
  road?: boolean;
};

/**
 * Phase color as paint behind the hero. HARD throbs with the drive bed.
 * The digits sit above this view and keep their own clock.
 */
export function Atmosphere({
  variant = 'ride',
  color = '#FFD60A',
  paused = false,
  heat = 'hot',
  reduceMotion = false,
  punch = 0,
  bloomMs = 520,
  pulses = 1,
  still = false,
  intensity = 1,
  pulse = false,
  beatMs = 500,
  road = false,
}: Props) {
  const breath = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const punchSeen = useRef<number | null>(null);
  const aOpacity = useRef(new Animated.Value(1)).current;
  const bOpacity = useRef(new Animated.Value(0)).current;
  const [aColor, setAColor] = useState(color);
  const [bColor, setBColor] = useState(color);
  const front = useRef<'a' | 'b'>('a');
  const insets = useSafeAreaInsets();
  const specks = useMemo(() => (road ? asphaltSpecks(64) : []), [road]);

  useEffect(() => {
    if (reduceMotion || still) {
      breath.setValue(1);
      return;
    }
    const half = pulse
      ? Math.max(90, Math.round(beatMs / 2))
      : paused
        ? 5200
        : variant === 'rest'
          ? 2800
          : heat === 'cool'
            ? 4600
            : 3400;
    const easing = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: half, easing, useNativeDriver: native }),
        Animated.timing(breath, { toValue: 0, duration: half, easing, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [beatMs, breath, heat, paused, pulse, reduceMotion, still, variant]);

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
    const ease = Easing.out(Easing.cubic);
    if (pulses === 2) {
      const half = Math.max(120, Math.round(bloomMs / 2));
      Animated.sequence([
        Animated.timing(burst, { toValue: 0, duration: half, easing: ease, useNativeDriver: native }),
        Animated.timing(burst, { toValue: 1, duration: 70, easing: ease, useNativeDriver: native }),
        Animated.timing(burst, { toValue: 0, duration: half, easing: ease, useNativeDriver: native }),
      ]).start();
    } else {
      Animated.timing(burst, {
        toValue: 0,
        duration: bloomMs,
        easing: ease,
        useNativeDriver: native,
      }).start();
    }
  }, [bloomMs, burst, pulses, punch, reduceMotion]);

  const scale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: reduceMotion || paused ? [1, 1] : pulse ? [1, 1.045] : [1, heat === 'cool' ? 1.03 : 1.04],
  });
  const presence = breath.interpolate({
    inputRange: [0, 1],
    outputRange: reduceMotion
      ? [1, 1]
      : paused
        ? [0.62, 0.62]
        : pulse
          ? [0.74, 1]
          : heat === 'cool'
            ? [0.86, 1]
            : [0.9, 1],
  });

  return (
    <View
      pointerEvents="none"
      style={[
        styles.fill,
        {
          top: -insets.top,
          bottom: -insets.bottom,
          left: -insets.left,
          right: -insets.right,
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(7,7,8,0)', colors.bg] as [string, string, string]}
        locations={[0, 0.55, 1] as [number, number, number]}
        style={styles.fill}
      />
      <Animated.View style={[styles.fill, { opacity: presence, transform: [{ scale }] }]}>
        {variant === 'rest' ? (
          <>
            <View style={[styles.fill, { backgroundColor: `rgba(255, 69, 58, ${HOME_HEAT})` }]} />
            <RestLight />
          </>
        ) : (
          <>
            <Animated.View style={[styles.fill, { opacity: aOpacity }]} pointerEvents="none">
              <PhaseLight color={aColor} id="phase-a" heat={heat} intensity={intensity} />
            </Animated.View>
            <Animated.View style={[styles.fill, { opacity: bOpacity }]} pointerEvents="none">
              <PhaseLight color={bColor} id="phase-b" heat={heat} intensity={intensity} />
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
      {road ? <RoadTexture color={color} specks={specks} /> : null}
    </View>
  );
}

function PhaseLight({
  color,
  id,
  heat,
  intensity = 1,
}: {
  color: string;
  id: string;
  heat: 'hot' | 'cool';
  intensity?: number;
}) {
  const gain = Number.isFinite(intensity) ? Math.min(1.12, Math.max(0.85, intensity)) : 1;
  const paint = scalePaint(fieldPaint(heat), gain);
  const lift = (value: number) => {
    const room = 1 - paint.edge;
    if (room <= 0) return '0';
    return String(Math.max(0, Math.min(1, (value - paint.edge) / room)));
  };
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="46%" rx="88%" ry="72%">
          <Stop offset="0" stopColor={color} stopOpacity={lift(paint.core)} />
          <Stop offset="0.48" stopColor={color} stopOpacity={lift(paint.mid)} />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={color} fillOpacity={paint.edge} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function scalePaint(paint: FieldPaint, gain: number): FieldPaint {
  return {
    core: Math.min(0.7, paint.core * gain),
    mid: Math.min(0.5, paint.mid * gain),
    edge: Math.min(0.32, paint.edge * gain),
  };
}

function RoadTexture({ color, specks }: { color: string; specks: { x: number; y: number }[] }) {
  return (
    <View pointerEvents="none" style={[styles.fill, { opacity: ROAD_WASH_OPACITY }]}>
      <Svg width="100%" height="100%">
        <Rect x="0" y="0" width="100%" height="100%" fill={color} opacity={0.45} />
        {ROAD_STREAKS.map((streak) => (
          <Rect
            key={`${streak.y}-${streak.thickness}`}
            x="0"
            y={`${streak.y * 100}%`}
            width="100%"
            height={`${streak.thickness * 100}%`}
            fill="#F5F5F7"
            opacity={streak.tone}
          />
        ))}
        {specks.map((speck, index) => (
          <Rect
            key={`${index}-${speck.x}-${speck.y}`}
            x={`${speck.x * 100}%`}
            y={`${speck.y * 100}%`}
            width={1.4}
            height={1.4}
            fill="#FFFFFF"
            opacity={index % 3 === 0 ? 0.7 : 0.32}
          />
        ))}
      </Svg>
    </View>
  );
}

function RestLight() {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id="rest-warm" cx="48%" cy="38%" rx="88%" ry="62%">
          <Stop offset="0" stopColor="#FF453A" stopOpacity="0.72" />
          <Stop offset="0.38" stopColor="#FF7A1A" stopOpacity="0.48" />
          <Stop offset="0.72" stopColor="#FFB020" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#FF7A1A" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="rest-cool" cx="92%" cy="18%" rx="36%" ry="24%">
          <Stop offset="0" stopColor="#64D2FF" stopOpacity="0.22" />
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
