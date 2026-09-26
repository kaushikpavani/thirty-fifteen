import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const native = Platform.OS !== 'web';

type Props = {
  /** 0–1 through the current segment. */
  progress: number;
  color: string;
  paused?: boolean;
};

/** The current interval, filling while the clock runs. Big jumps glide. */
export function SegmentRail({ progress, color, paused = false }: Props) {
  const width = useRef(new Animated.Value(clamp(progress))).current;
  const life = useRef(new Animated.Value(0)).current;
  const last = useRef(progress);

  useEffect(() => {
    const next = clamp(progress);
    const delta = Math.abs(next - last.current);
    last.current = next;
    if (delta > 0.04) {
      Animated.timing(width, { toValue: next, duration: 280, useNativeDriver: false }).start();
    } else {
      width.setValue(next);
    }
  }, [progress, width]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(life, { toValue: 1, duration: paused ? 1800 : 1100, useNativeDriver: native }),
        Animated.timing(life, { toValue: 0, duration: paused ? 1800 : 1100, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [life, paused]);

  const pct = width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const head = life.interpolate({ inputRange: [0, 1], outputRange: paused ? [0.35, 0.55] : [0.55, 1] });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width: pct, backgroundColor: color, opacity: paused ? 0.45 : 1 }]}>
        <Animated.View style={[styles.head, { opacity: head }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)'] as [string, string]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.headFill}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    marginHorizontal: 28,
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  head: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 36,
  },
  headFill: { flex: 1 },
});
