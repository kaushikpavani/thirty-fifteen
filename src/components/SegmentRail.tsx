import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type Props = {
  /** 0–1 through the current segment. */
  progress: number;
  color: string;
  paused?: boolean;
  reduceMotion?: boolean;
};

/** Thin fill for the current interval. No head, dots, or badges. */
export function SegmentRail({ progress, color, paused = false }: Props) {
  const width = useRef(new Animated.Value(clamp(progress))).current;
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

  const pct = width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width: pct, backgroundColor: color, opacity: paused ? 0.45 : 0.85 }]} />
    </View>
  );
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const styles = StyleSheet.create({
  track: {
    height: 2,
    marginHorizontal: 28,
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  fill: {
    height: 2,
    borderRadius: 999,
  },
});
