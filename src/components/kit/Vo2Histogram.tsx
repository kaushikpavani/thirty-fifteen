import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { VO2_NORMS_SOURCE } from '../../data/vo2Norms';
import { histogram, percentileOf, standing, valueAtPercentile, type StandingSex } from '../../logic/vo2Standing';
import { ink, type } from '../../theme/tokens';

const H = 168;
const TOP = 30; // room for the "You" label
const R = 3.5;

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** A bar with rounded top corners, square at the baseline. */
function bar(x: number, y: number, w: number, base: number): string {
  const r = Math.min(R, w / 2, Math.max(0, base - y));
  return `M${x},${base} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${base} Z`;
}

/**
 * Where the rider stands among people their own age and sex: the group's
 * VO2max distribution (FRIEND registry), with everyone the rider is ahead
 * of filled in, a "You" marker with its uncertainty range, and the median.
 * Drag across it to read any value's percentile.
 */
export function Vo2Histogram({
  value,
  low,
  high,
  ageYears,
  sex,
  testID,
}: {
  value: number;
  low: number;
  high: number;
  ageYears: number;
  sex: StandingSex;
  testID?: string;
}) {
  const [width, setWidth] = useState(0);
  const [probe, setProbe] = useState<number | null>(null);

  const here = useMemo(() => standing(value, ageYears, sex), [value, ageYears, sex]);
  const dist = useMemo(() => histogram(here.band), [here.band]);

  const base = H - 1;
  const span = dist.max - dist.min;
  const x = (v: number) => ((Math.min(dist.max, Math.max(dist.min, v)) - dist.min) / span) * width;
  const peak = Math.max(...dist.bins.map((b) => b.share));
  const y = (share: number) => base - (share / peak) * (base - TOP);

  const bars = dist.bins.map((b) => bar(x(b.x0) + 1, y(b.share), Math.max(1, x(b.x1) - x(b.x0) - 2), base)).join(' ');
  const youX = x(value);
  const ticks: number[] = [];
  for (let t = Math.ceil(dist.min / 10) * 10; t <= dist.max; t += 10) ticks.push(t);

  const pick = (e: GestureResponderEvent) => {
    if (!width) return;
    const v = dist.min + (Math.min(width, Math.max(0, e.nativeEvent.locationX)) / width) * span;
    setProbe(Math.round(v * 2) / 2);
  };

  const landmarks = [
    { label: 'Median', value: here.median },
    { label: 'Top 25%', value: valueAtPercentile(75, here.band) },
    { label: 'Top 10%', value: here.band.deciles[8] },
  ];
  const probePct = probe != null ? Math.min(99, Math.max(1, Math.round(percentileOf(probe, here.band)))) : null;
  const labelW = 86;
  const labelLeft = Math.min(Math.max(0, youX - labelW / 2), Math.max(0, width - labelW));

  return (
    <View testID={testID}>
      <Text style={styles.kicker}>WHERE YOU STAND</Text>
      <Text style={styles.hero}>
        Fitter than <Text style={styles.heroNum}>{here.percentile}%</Text>
      </Text>
      <Text style={styles.sub}>
        of {here.group} · <Text style={styles.level}>{here.level}</Text>
      </Text>

      <View
        style={styles.plot}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setProbe(null)}
        onResponderTerminate={() => setProbe(null)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`VO2max distribution for ${here.group}. You are at ${value.toFixed(1)}, the ${ordinal(here.percentile)} percentile. The median is ${here.median}.`}
      >
        {width > 0 ? (
          <>
            <Svg width={width} height={H}>
              <Defs>
                <LinearGradient id="vo2Ahead" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={ink.glacier} stopOpacity={1} />
                  <Stop offset="1" stopColor={ink.glacier} stopOpacity={0.55} />
                </LinearGradient>
                <ClipPath id="vo2Passed">
                  <Rect x={0} y={0} width={youX} height={H} />
                </ClipPath>
              </Defs>
              {/* Everyone, muted. */}
              <Path d={bars} fill={ink.raised} />
              {/* The share of the group you're ahead of, filled in up to your value. */}
              <G clipPath="url(#vo2Passed)">
                <Path d={bars} fill="url(#vo2Ahead)" />
              </G>
              <Line x1={0} x2={width} y1={base + 0.5} y2={base + 0.5} stroke={ink.hairline} strokeWidth={1} />
              {/* Median */}
              <Line
                x1={x(here.median)}
                x2={x(here.median)}
                y1={TOP - 6}
                y2={base}
                stroke={ink.secondary}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
              {/* Your likely range, then you. */}
              <Rect x={x(low)} y={base - 3} width={Math.max(2, x(high) - x(low))} height={6} rx={3} fill={ink.ember} opacity={0.45} />
              <Line x1={youX} x2={youX} y1={TOP - 4} y2={base} stroke={ink.ember} strokeWidth={2} />
              <Circle cx={youX} cy={base} r={5} fill={ink.ember} stroke={ink.surface} strokeWidth={2} />
              {probe != null ? (
                <Line x1={x(probe)} x2={x(probe)} y1={TOP - 6} y2={base} stroke={ink.text} strokeWidth={1} />
              ) : null}
            </Svg>
            <View style={[styles.you, { left: labelLeft, width: labelW }]} pointerEvents="none">
              <Text style={styles.youText}>You · {value.toFixed(1)}</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.axis}>
        {width > 0
          ? ticks.map((t) => (
              <Text key={t} style={[styles.tick, { left: x(t) - 14 }]}>
                {t}
              </Text>
            ))
          : null}
      </View>

      <Text style={styles.readout} accessibilityLiveRegion="polite">
        {probe != null
          ? `${probe.toFixed(1)} ml/kg/min is the ${ordinal(probePct!)} percentile`
          : 'Drag across the chart to explore · ml/kg/min'}
      </Text>

      <View style={styles.marks}>
        {landmarks.map((m) => (
          <View key={m.label} style={styles.mark}>
            <Text style={styles.markValue}>{m.value.toFixed(1)}</Text>
            <Text style={styles.markLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {here.next ? (
        <Text style={styles.next}>
          <Text style={styles.nextStrong}>+{here.next.gap.toFixed(1)}</Text> gets you to the top {100 - here.next.percentile}% (
          {here.next.value.toFixed(1)}).
        </Text>
      ) : (
        <Text style={styles.next}>You&apos;re in the top 5% for your age.</Text>
      )}

      <Text style={styles.source}>
        Compared with {VO2_NORMS_SOURCE.tests.toLocaleString()} lab treadmill tests of healthy adults ({VO2_NORMS_SOURCE.short}). The
        orange bar is your estimate&apos;s likely range. Bike values run a little lower than treadmill ones, so this is a slightly tough
        comparison for riders.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { color: ink.tertiary, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  hero: { color: ink.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.6, marginTop: 6 },
  heroNum: { color: ink.text, fontSize: 30, fontWeight: '700' },
  sub: { color: ink.secondary, ...type.callout, marginTop: 2 },
  level: { color: ink.text, fontWeight: '600' },
  plot: { height: H, marginTop: 14 },
  you: { position: 'absolute', top: 0, alignItems: 'center' },
  youText: {
    color: '#000',
    backgroundColor: ink.ember,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    ...type.tabular,
  },
  axis: { height: 16, marginTop: 4 },
  tick: { position: 'absolute', width: 28, textAlign: 'center', color: ink.tertiary, fontSize: 11, ...type.tabular },
  readout: { color: ink.tertiary, fontSize: 11, textAlign: 'center', marginTop: 6, ...type.tabular },
  marks: { flexDirection: 'row', marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ink.hairline, paddingTop: 12 },
  mark: { flex: 1, alignItems: 'center', gap: 2 },
  markValue: { color: ink.text, fontSize: 18, fontWeight: '600', ...type.tabular },
  markLabel: { color: ink.secondary, fontSize: 12 },
  next: { color: ink.secondary, ...type.callout, marginTop: 14, textAlign: 'center' },
  nextStrong: { color: ink.text, fontWeight: '700' },
  source: { color: ink.tertiary, fontSize: 11, lineHeight: 15, marginTop: 12 },
});
