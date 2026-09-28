import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Segment } from '../../types';
import { ink } from '../../theme/tokens';

type Bar = { w: number; h: number; c: string; key: string };

const DUSK = '#5E6B7A';
const REST = '#3A4152';

/**
 * The session as a workout profile. Shape only, never watts:
 * FTP and targets live in Settings, not Home.
 */
export function profileBars(segments: Segment[]): Bar[] {
  const bars: Bar[] = [];
  let n = 0;
  const push = (w: number, h: number, c: string) => bars.push({ w, h, c, key: `b${n++}` });
  const gap = () => push(3, 0, 'transparent');
  let prev: Segment['kind'] | null = null;
  for (const seg of segments) {
    if (seg.kind === 'warmup' && prev == null) {
      for (let i = 0; i < 8; i++) push(4, 0.2 + i * 0.04, DUSK);
    } else if (seg.kind === 'warmup') {
      push(4, 0.44, DUSK);
    } else if (seg.kind === 'accel') {
      push(3, 0.72, ink.ember);
    } else if (seg.kind === 'hard') {
      if (prev !== 'easy') gap();
      push(3, 1, ink.ember);
    } else if (seg.kind === 'easy') {
      push(2, 0.24, ink.glacier);
    } else if (seg.kind === 'set_rest') {
      gap();
      for (let i = 0; i < 3; i++) push(4, 0.14, REST);
    } else if (seg.kind === 'cooldown') {
      gap();
      for (let i = 0; i < 6; i++) push(4, 0.4 - i * 0.05, DUSK);
    }
    prev = seg.kind;
  }
  return bars;
}

export function ProfileChart({ segments, height = 104 }: { segments: Segment[]; height?: number }) {
  const bars = useMemo(() => profileBars(segments), [segments]);
  return (
    <View
      style={[styles.row, { height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Session profile: warm-up, hard and easy reps, cool-down"
    >
      {bars.map((bar) => (
        <View
          key={bar.key}
          style={{ flex: bar.w, height: Math.round(bar.h * height), backgroundColor: bar.c, borderRadius: 1.5 }}
        />
      ))}
    </View>
  );
}

/** Reps in the current set. Done reps solid, the live rep filling, the rest faint. */
export function RepRail({
  count,
  done,
  progress,
  solid = 'rgba(255,255,255,0.95)',
  faint = 'rgba(255,255,255,0.3)',
  height = 5,
}: {
  count: number;
  done: number;
  progress: number;
  solid?: string;
  faint?: string;
  height?: number;
}) {
  const items = Array.from({ length: Math.max(1, count) }, (_, i) => i);
  return (
    <View style={styles.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {items.map((i) => {
        const fill = i < done ? 1 : i === done ? Math.max(0, Math.min(1, progress)) : 0;
        return (
          <View key={i} style={[styles.capsule, { height, borderRadius: height / 2, backgroundColor: faint }]}>
            {fill > 0 ? <View style={{ width: `${fill * 100}%`, height, backgroundColor: solid, borderRadius: height / 2 }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  rail: { flexDirection: 'row', gap: 4, alignSelf: 'stretch' },
  capsule: { flex: 1, overflow: 'hidden' },
});
