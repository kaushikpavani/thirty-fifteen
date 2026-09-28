import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import type { RideSummary } from '../types';
import { formatClock } from '../workout/builder';

function Icon({ name, color }: { name: 'heart' | 'flame' | 'ring' | 'check' | 'timer' | 'bolt'; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'heart' ? (
        <Path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" fill={color} />
      ) : null}
      {name === 'flame' ? <Path d="M12 2s6 6 6 11a6 6 0 1 1-12 0c0-2 2-4 2-4s0 3 2 3 2-10 2-10z" fill={color} /> : null}
      {name === 'ring' ? (
        <>
          <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth="2.4" fill="none" />
          <Path d="M12 12 L12 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : null}
      {name === 'check' ? (
        <>
          <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth="2" fill="none" />
          <Path d="M8 12.5 11 15.5 16.5 9" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ) : null}
      {name === 'timer' ? (
        <>
          <Circle cx="12" cy="13" r="7" stroke={color} strokeWidth="2" fill="none" />
          <Path d="M12 13 V9 M9 4 H15" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : null}
      {name === 'bolt' ? <Path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill={color} /> : null}
    </Svg>
  );
}

function Stat({
  label,
  value,
  unit,
  icon,
  tint,
  testID,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: 'heart' | 'flame' | 'ring' | 'check' | 'timer' | 'bolt';
  tint: string;
  testID?: string;
}) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.cardTop}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Icon name={icon} color={tint} />
      </View>
      <Text style={styles.cardValue}>
        {value}
        {unit ? <Text style={styles.cardUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function Sparkline({ values, durationMs, avg }: { values: number[]; durationMs: number; avg: number | null }) {
  if (values.length < 2) return null;
  const width = 320;
  const height = 72;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 8 - ((value - min) / span) * (height - 16);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const mid = formatClock(durationMs / 2);
  return (
    <View style={styles.chart} testID="done-sparkline">
      <View style={styles.chartTop}>
        <Text style={styles.cardLabel}>Power</Text>
        {avg != null ? <Text style={styles.chartAvg}>{avg} W</Text> : null}
      </View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline points={points} fill="none" stroke="#E7A4FF" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
      <View style={styles.chartAxis}>
        <Text style={styles.axis}>0:00</Text>
        <Text style={styles.axis}>{mid}</Text>
        <Text style={styles.axis}>{formatClock(durationMs)}</Text>
      </View>
    </View>
  );
}

export function DoneSummary({ summary, onDone }: { summary: RideSummary; onDone: () => void }) {
  const power = summary.avgWatts != null || summary.sparkline.length > 0;
  const hr = summary.avgBpm != null;
  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {power ? (
          <Stat label="Avg W" value={String(summary.avgWatts ?? '—')} unit="W" icon="heart" tint="#F2A6E0" testID="done-avg-watts" />
        ) : null}
        {power ? (
          <Stat label="Peak W" value={String(summary.peakWatts ?? '—')} unit="W" icon="flame" tint="#E7A4FF" testID="done-peak-watts" />
        ) : null}
        <Stat label="Time in HARD" value={formatClock(summary.hardMs)} unit="min" icon="ring" tint="#FF6B8A" testID="done-hard-time" />
        <Stat label="Time in EASY" value={formatClock(summary.easyMs)} unit="min" icon="ring" tint="#C9A6FF" testID="done-easy-time" />
        <Stat
          label="Sets"
          value={`${summary.setsDone} of ${summary.setsPlanned}`}
          icon="check"
          tint="#E7A4FF"
          testID="done-sets"
        />
        <Stat label="Duration" value={formatClock(summary.durationMs)} icon="timer" tint="#D7B4FF" testID="done-duration" />
        {power ? (
          <Stat label="Work" value={String(summary.workKj ?? 0)} unit="kJ" icon="bolt" tint="#E7A4FF" testID="done-work" />
        ) : null}
        {power && summary.avgHardWatts != null ? (
          <Stat label="Hard avg" value={String(summary.avgHardWatts)} unit="W" icon="flame" tint="#FF8AA8" testID="done-hard-watts" />
        ) : null}
        {power && summary.avgEasyWatts != null ? (
          <Stat label="Easy avg" value={String(summary.avgEasyWatts)} unit="W" icon="heart" tint="#C9A6FF" testID="done-easy-watts" />
        ) : null}
        {hr ? <Stat label="Avg HR" value={String(summary.avgBpm)} unit="bpm" icon="heart" tint="#FF8AA8" testID="done-avg-hr" /> : null}
        {hr ? <Stat label="Max HR" value={String(summary.maxBpm ?? '—')} unit="bpm" icon="heart" tint="#FF6B8A" testID="done-max-hr" /> : null}
        {hr && summary.avgHardBpm != null ? (
          <Stat label="Hard HR" value={String(summary.avgHardBpm)} unit="bpm" icon="heart" tint="#FF8AA8" testID="done-hard-hr" />
        ) : null}
        {hr && summary.avgEasyBpm != null ? (
          <Stat label="Easy HR" value={String(summary.avgEasyBpm)} unit="bpm" icon="heart" tint="#E7A4FF" testID="done-easy-hr" />
        ) : null}
      </View>
      {power ? <Sparkline values={summary.sparkline} durationMs={summary.durationMs} avg={summary.avgWatts} /> : null}
      <Pressable accessibilityRole="button" onPress={onDone} testID="done" style={styles.doneHit}>
        <LinearGradient colors={['#FF9BB8', '#FF6B95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.done}>
          <Text style={styles.doneLabel}>Done</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: 'rgba(22,16,32,0.55)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 84,
    justifyContent: 'space-between',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '500' },
  cardValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 8 },
  cardUnit: { fontSize: 16, fontWeight: '600' },
  chart: {
    backgroundColor: 'rgba(22,16,32,0.55)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  chartTop: { flexDirection: 'row', justifyContent: 'space-between' },
  chartAvg: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axis: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  doneHit: { marginTop: 6, borderRadius: 16, overflow: 'hidden' },
  done: { minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  doneLabel: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
