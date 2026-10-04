import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { tracePath, tracePoints } from '../../logic/effortTrace';
import { ink } from '../../theme/tokens';

const native = Platform.OS !== 'web';
const DRAW_MS = 5200;
const HOLD_MS = 1800;
const FADE_MS = 500;

/**
 * The session drawing itself: a faint outline of today's efforts, and an
 * ember line that sweeps across it, pauses, and starts again. Replaces the
 * bike illustration, so the card is about the work.
 *
 * The sweep is a clipped layer sliding open (two opposite transforms), so
 * it runs on the native thread and costs nothing while the rider reads the
 * screen. With Reduce Motion on, the line is simply drawn in full.
 */
export function EffortTrace({ segments, height = 112, testID }: { segments: readonly { kind: string }[]; height?: number; testID?: string }) {
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);
  const progress = useAnimatedValue(0);
  const glow = useAnimatedValue(1);

  const d = useMemo(() => tracePath(tracePoints(segments), width, height), [segments, width, height]);
  const area = d ? `${d} L${width} ${height} L0 ${height} Z` : '';

  useEffect(() => {
    if (reduce || width === 0) {
      progress.setValue(1);
      glow.setValue(1);
      return;
    }
    progress.setValue(0);
    glow.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: DRAW_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }),
        Animated.delay(HOLD_MS),
        Animated.timing(glow, { toValue: 0, duration: FADE_MS, useNativeDriver: native }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: native }),
        Animated.timing(glow, { toValue: 1, duration: 0, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, width, progress, glow]);

  // The window slides in from the left while its contents slide the other way, so the line stays put and is revealed.
  const open = progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] });
  const counter = progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });
  const head = progress.interpolate({ inputRange: [0, 1], outputRange: [0, width] });
  const headGlow = progress.interpolate({ inputRange: [0, 0.04, 0.96, 1], outputRange: [0, 1, 1, 0] });

  return (
    <View
      style={{ height }}
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Session profile: warm-up, hard and easy reps, cool-down"
      testID={testID}
    >
      {width > 0 && d ? (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke={ink.glacier} strokeOpacity={0.35} strokeWidth={1} />
            <Path d={d} fill="none" stroke={ink.ember} strokeOpacity={0.26} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, styles.clip, { opacity: glow, transform: [{ translateX: open }] }]}>
            <Animated.View style={{ width, height, transform: [{ translateX: counter }] }}>
              <Svg width={width} height={height}>
                <Defs>
                  <SvgGradient id="traceFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={ink.ember} stopOpacity={0.3} />
                    <Stop offset="1" stopColor={ink.ember} stopOpacity={0} />
                  </SvgGradient>
                </Defs>
                <Path d={area} fill="url(#traceFill)" />
                <Path d={d} fill="none" stroke={ink.ember} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
              </Svg>
            </Animated.View>
          </Animated.View>
          {reduce ? null : (
            <Animated.View pointerEvents="none" style={[styles.head, { height, opacity: Animated.multiply(glow, headGlow), transform: [{ translateX: head }] }]}>
              <LinearGradient colors={['rgba(255,180,135,0)', 'rgba(255,180,135,0.34)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.trail} />
              <View style={styles.edge} />
            </Animated.View>
          )}
        </>
      ) : null}
    </View>
  );
}

const TRAIL = 26;

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  head: { position: 'absolute', left: -TRAIL, top: 0, width: TRAIL + 1.5, flexDirection: 'row' },
  trail: { width: TRAIL },
  edge: { width: 1.5, backgroundColor: '#FFB487' },
});
