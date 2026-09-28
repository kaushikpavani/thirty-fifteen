import React, { useEffect } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { ink, radius, type } from '../theme/tokens';
import type { RideSummary } from '../types';
import { FINISH_SUBTITLE, FINISH_TITLE } from '../workout/craft';
import { clockText } from '../logic/rideView';
import { Icon } from './kit/Icon';
import { Pill } from './kit/Pill';
import { BIKE_TONES, RoadBike, RoadStream } from './bike/RoadBike';

const native = Platform.OS !== 'web';
const WEEKDAY = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

type Stat = { label: string; value: string; unit: string };

export function doneStats(summary: RideSummary): Stat[] {
  const out: Stat[] = [];
  if (summary.avgHardWatts != null) out.push({ label: 'Hard avg', value: String(summary.avgHardWatts), unit: 'W' });
  if (summary.avgEasyWatts != null) out.push({ label: 'Easy avg', value: String(summary.avgEasyWatts), unit: 'W' });
  if (summary.workKj != null) out.push({ label: 'Work', value: String(summary.workKj), unit: 'kJ' });
  if (summary.avgBpm != null) out.push({ label: 'Avg heart', value: String(summary.avgBpm), unit: 'bpm' });
  if (summary.maxBpm != null) out.push({ label: 'Max heart', value: String(summary.maxBpm), unit: 'bpm' });
  if (summary.avgHardWatts == null) out.push({ label: 'In HARD', value: clockText(summary.hardMs), unit: '' });
  out.push({ label: 'Time', value: clockText(summary.durationMs), unit: '' });
  return out;
}

/** Two soft lights, ember and glacier, that bloom once behind the title. */
function Bloom({ width }: { width: number }) {
  return (
    <Svg width={width} height={420} style={styles.bloom} pointerEvents="none">
      <Defs>
        <RadialGradient id="doneEmber" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#FF5A1F" stopOpacity={0.42} />
          <Stop offset="1" stopColor="#FF5A1F" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="doneGlacier" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#5CC8E6" stopOpacity={0.26} />
          <Stop offset="1" stopColor="#5CC8E6" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={width * 0.3} cy={30} rx={200} ry={220} fill="url(#doneEmber)" />
      <Ellipse cx={width * 0.85} cy={60} rx={180} ry={200} fill="url(#doneGlacier)" />
    </Svg>
  );
}

function RepChart({ reps, perSet, target }: { reps: number[]; perSet: number; target: number }) {
  const height = 96;
  const lo = Math.min(target, ...reps) * 0.7;
  const hi = Math.max(target, ...reps);
  const scale = (w: number) => Math.max(6, Math.round(((w - lo) / Math.max(1, hi - lo)) * (height - 8)));
  const targetY = scale(target);
  return (
    <View
      style={[styles.chart, { height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Average power for each hard rep. Target ${target} watts.`}
    >
      {reps.map((w, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: scale(w),
            borderRadius: 3,
            backgroundColor: w >= target ? ink.ember : '#B8471F',
            marginLeft: i > 0 && i % Math.max(1, perSet) === 0 ? 10 : 0,
          }}
        />
      ))}
      <View style={[styles.targetLine, { bottom: targetY }]} />
    </View>
  );
}

export function DoneSummary({
  summary,
  reps,
  hardTarget,
  onDone,
}: {
  summary: RideSummary;
  reps: number;
  hardTarget: number;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const rise = useAnimatedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    Animated.spring(rise, { toValue: 1, useNativeDriver: native, speed: 6, bounciness: 6 }).start();
  }, [reduce, rise]);

  const day = WEEKDAY[new Date().getDay()];
  const complete = summary.setsDone >= summary.setsPlanned;
  const kicker = `${day} · ${summary.setsDone} × ${reps}${complete ? ' COMPLETE' : ''}`;
  const repWatts = summary.repWatts ?? [];
  const stats = doneStats(summary);
  const titleStyle = {
    opacity: rise,
    transform: [
      { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: rise }]} pointerEvents="none">
        <Bloom width={width} />
      </Animated.View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>{kicker}</Text>
        <Animated.Text style={[styles.title, titleStyle]} accessibilityRole="header">
          {FINISH_TITLE}
        </Animated.Text>
        <Text style={styles.subtitle}>{FINISH_SUBTITLE}</Text>

        {repWatts.length > 0 ? (
          <View style={styles.card} testID="done-power">
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Power, rep by rep</Text>
              <View style={styles.targetKey}>
                <View style={styles.targetDash} />
                <Text style={styles.cardMeta}>Target {hardTarget} W</Text>
              </View>
            </View>
            <RepChart reps={repWatts} perSet={reps} target={hardTarget} />
          </View>
        ) : null}

        <View style={[styles.card, styles.grid]} testID="done-stats">
          {stats.map((s) => (
            <View key={s.label} style={styles.cell} accessible accessibilityLabel={`${s.label} ${s.value} ${s.unit}`}>
              <Text style={styles.cellLabel}>{s.label}</Text>
              <Text style={styles.cellValue}>
                {s.value}
                {s.unit ? <Text style={styles.cellUnit}> {s.unit}</Text> : null}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.flex} />
        <View style={styles.bikeRow} pointerEvents="none">
          <RoadBike width={Math.min(240, width * 0.6)} tone={BIKE_TONES.ember} wheelPeriodMs={reduce ? null : 1100} />
          <RoadStream width={width - 32} periodMs={reduce ? null : 700} color="rgba(255,200,170,0.25)" />
        </View>
        <View style={styles.saved}>
          <Icon name="check" size={14} color={ink.signal} />
          <Text style={styles.savedText}>Saved on this iPhone</Text>
        </View>
        <Pill label="Done" variant="light" onPress={onDone} testID="done" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bloom: { position: "absolute", top: 0, left: 0 },
  scroll: { flexGrow: 1, paddingHorizontal: 16 },
  kicker: { color: '#FF8A55', fontSize: 13, fontWeight: '600', letterSpacing: 1.5, paddingHorizontal: 4, fontVariant: ['tabular-nums'] },
  title: { color: ink.text, fontSize: 44, lineHeight: 48, fontWeight: '700', letterSpacing: -1.4, marginTop: 10, paddingHorizontal: 4 },
  subtitle: { color: '#A8A8AE', fontSize: 20, marginTop: 8, paddingHorizontal: 4 },
  card: { backgroundColor: ink.surface, borderRadius: radius.card - 2, padding: 18, marginTop: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 },
  cardTitle: { color: ink.text, fontSize: 15, fontWeight: '600' },
  cardMeta: { color: ink.secondary, ...type.caption },
  targetKey: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  targetDash: { width: 12, borderTopWidth: 2, borderStyle: 'dashed', borderColor: ink.secondary },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  targetLine: {
    position: 'absolute',
    left: -4,
    right: -4,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.85)',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 0, paddingVertical: 6 },
  cell: { width: '33.33%', paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  cellLabel: { color: ink.secondary, ...type.caption },
  cellValue: { color: ink.text, fontSize: 26, fontWeight: '600', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  cellUnit: { color: ink.secondary, fontSize: 14, fontWeight: '500', letterSpacing: 0 },
  flex: { flex: 1, minHeight: 12 },
  bikeRow: { alignItems: 'center', marginBottom: 18, gap: 2 },
  saved: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
  savedText: { color: ink.tertiary, ...type.caption },
});
