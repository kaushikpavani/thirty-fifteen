import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { ink, type } from '../../theme/tokens';

/**
 * Power (bars) and heart rate (line) for the same reps, so a rider can see
 * how their cardiac response tracked their output — the "correlate them"
 * view. Both series share an x-axis (rep number) but scale independently,
 * since watts and bpm live on very different ranges.
 */
export function RepDualChart({
  watts,
  bpm,
  target,
  height = 130,
}: {
  watts: number[];
  bpm: number[];
  target: number;
  height?: number;
}) {
  const n = Math.min(watts.length, bpm.length);
  if (n === 0) return null;
  const w = watts.slice(0, n);
  const b = bpm.slice(0, n);

  const wLo = Math.min(target, ...w) * 0.7;
  const wHi = Math.max(target, ...w);
  const scaleW = (value: number) => Math.max(2, ((value - wLo) / Math.max(1, wHi - wLo)) * height);

  const bLo = Math.min(...b) * 0.92;
  const bHi = Math.max(...b) * 1.04;
  const scaleB = (value: number) => height - ((value - bLo) / Math.max(1, bHi - bLo)) * height;

  const barW = 100 / n;
  const points = b.map((bpmValue, i) => `${i * barW + barW / 2},${scaleB(bpmValue)}`).join(' ');

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {w.map((watt, i) => {
          const h = scaleW(watt);
          return (
            <Rect
              key={i}
              x={i * barW + barW * 0.18}
              y={height - h}
              width={barW * 0.64}
              height={h}
              rx={0.6}
              fill={watt >= target ? ink.ember : '#B8471F'}
            />
          );
        })}
        <Polyline points={points} fill="none" stroke={ink.glacier} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        {b.map((bpmValue, i) => (
          <Circle key={i} cx={i * barW + barW / 2} cy={scaleB(bpmValue)} r={1.4} fill={ink.glacier} />
        ))}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: ink.ember }]} />
          <Text style={styles.legendText}>Watts</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.swatchLine, { backgroundColor: ink.glacier }]} />
          <Text style={styles.legendText}>Heart rate</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  swatchLine: { borderRadius: 5 },
  legendText: { color: ink.secondary, ...type.caption },
});
