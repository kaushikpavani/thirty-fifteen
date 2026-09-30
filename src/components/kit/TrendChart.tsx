import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { ink, type } from '../../theme/tokens';
import type { Point } from '../../logic/trends';

const PAD = { top: 10, right: 12, bottom: 8, left: 40 };

function shortDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * One metric over time: each ride as a faint dot, the rolling average as
 * the line. Drag across it to read any ride (the touch version of a hover
 * crosshair). Single series, single axis; the screen's title names it.
 */
export function TrendChart({
  points,
  smooth,
  color,
  unit,
  decimals,
  height = 190,
  testID,
}: {
  points: Point[];
  smooth: Point[];
  color: string;
  unit: string;
  decimals: number;
  height?: number;
  testID?: string;
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const geom = useMemo(() => {
    if (points.length === 0 || width === 0) return null;
    const values = points.map((p) => p.value);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (hi === lo) {
      lo -= Math.max(1, Math.abs(lo) * 0.05);
      hi += Math.max(1, Math.abs(hi) * 0.05);
    }
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
    const t0 = points[0]!.t;
    const t1 = points[points.length - 1]!.t;
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW);
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
    const ticks = [hi - pad, (lo + hi) / 2, lo + pad];
    const line = smooth.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    return { x, y, ticks, line, t0, t1 };
  }, [points, smooth, width, height]);

  const pick = (e: GestureResponderEvent) => {
    if (!geom) return;
    const px = e.nativeEvent.locationX;
    let best = 0;
    let dist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(geom.x(p.t) - px);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setActive(best);
  };

  const shown = active != null ? points[active] : null;
  const shownAvg = active != null ? smooth[active] : smooth[smooth.length - 1];
  const fmt = (v: number) => v.toFixed(decimals);

  return (
    <View testID={testID}>
      <Text style={styles.readout} accessibilityLiveRegion="polite">
        {shown
          ? `${shortDate(shown.t)} · ${fmt(shown.value)} ${unit}  ·  trend ${fmt(shownAvg!.value)}`
          : smooth.length
            ? `Trend now ${fmt(smooth[smooth.length - 1]!.value)} ${unit} · drag to see each ride`
            : ' '}
      </Text>
      <View
        style={{ height }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          smooth.length
            ? `Trend over ${points.length} rides, from ${fmt(smooth[0]!.value)} to ${fmt(smooth[smooth.length - 1]!.value)} ${unit}.`
            : 'No rides with this metric yet.'
        }
      >
        {geom ? (
          <Svg width={width} height={height}>
            {geom.ticks.map((v, i) => (
              <Line key={i} x1={PAD.left} x2={width - PAD.right} y1={geom.y(v)} y2={geom.y(v)} stroke={ink.hairline} strokeWidth={1} />
            ))}
            {points.map((p, i) => (
              <Circle key={p.rideId + i} cx={geom.x(p.t)} cy={geom.y(p.value)} r={4} fill={color} opacity={active === i ? 0 : 0.35} />
            ))}
            {smooth.length > 1 ? (
              <Path d={geom.line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
            {shown ? (
              <>
                <Line x1={geom.x(shown.t)} x2={geom.x(shown.t)} y1={PAD.top} y2={height - PAD.bottom} stroke={ink.secondary} strokeWidth={1} />
                <Circle cx={geom.x(shown.t)} cy={geom.y(shown.value)} r={6} fill={color} stroke={ink.surface} strokeWidth={2} />
              </>
            ) : null}
          </Svg>
        ) : null}
        {geom
          ? geom.ticks.map((v, i) => (
              <Text key={i} style={[styles.tick, { top: geom.y(v) - 8 }]}>
                {fmt(v)}
              </Text>
            ))
          : null}
      </View>
      {geom ? (
        <View style={styles.axis}>
          <Text style={styles.axisText}>{shortDate(geom.t0)}</Text>
          <Text style={styles.axisText}>{shortDate(geom.t1)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Stat-tile sparkline: recent rides in the de-emphasis grey, the latest in the accent. */
export function Sparkline({ values, color, width = 72, height = 24 }: { values: number[]; color: string; width?: number; height?: number }) {
  const v = values.slice(-12);
  if (v.length < 2) return <View style={{ width, height }} />;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const span = hi - lo || 1;
  const x = (i: number) => 3 + (i / (v.length - 1)) * (width - 6);
  const y = (n: number) => 3 + (1 - (n - lo) / span) * (height - 6);
  const d = v.map((n, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(' ');
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={ink.faint} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
      <Circle cx={x(v.length - 1)} cy={y(v[v.length - 1]!)} r={3} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  readout: { color: ink.secondary, ...type.caption, ...type.tabular, marginBottom: 8 },
  tick: { position: 'absolute', left: 0, width: PAD.left - 8, textAlign: 'right', color: ink.tertiary, fontSize: 11, ...type.tabular },
  axis: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: PAD.left, paddingRight: PAD.right, marginTop: 4 },
  axisText: { color: ink.tertiary, fontSize: 11 },
});
