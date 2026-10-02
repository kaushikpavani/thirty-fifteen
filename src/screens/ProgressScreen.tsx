import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Footer, LargeTitle, NavBack } from '../components/kit/Grouped';
import { Pill } from '../components/kit/Pill';
import { Sparkline, TrendChart } from '../components/kit/TrendChart';
import { WeekBars } from '../components/kit/WeekBars';
import { useAuth } from '../auth/AuthContext';
import { useHistory } from '../state/HistoryContext';
import { ink, radius, type, surface } from '../theme/tokens';
import {
  deltaText,
  inPeriod,
  METRICS,
  metricPoints,
  periodDelta,
  PERIODS,
  personalRecords,
  rollingMean,
  weekStreak,
  weeklyVolume,
  type MetricId,
  type Period,
} from '../logic/trends';

const TILES: MetricId[] = ['hardWatts', 'efficiency', 'drift', 'ftp'];
const COLOR: Record<MetricId, string> = {
  hardWatts: ink.ember,
  ftp: ink.ember,
  efficiency: ink.glacier,
  drift: ink.glacier,
  hardBpm: ink.glacier,
};
const SMOOTH = 5;

function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Progress for signed-in riders: how the numbers that matter for 30/15 are
 * moving, week-by-week volume, and personal bests. Everything is computed
 * on the phone from the rider's own rides.
 */
export function ProgressScreen() {
  const auth = useAuth();
  const history = useHistory();
  const [period, setPeriod] = useState<Period>('3m');
  const [selected, setSelected] = useState<MetricId>('hardWatts');
  // Freeze "now" per visit so a render doesn't shift the windows.
  const [now] = useState(() => Date.now());
  const rides = history.sessions;
  const prior = PERIODS.find((p) => p.id === period)!.prior;

  const series = useMemo(() => {
    const out = {} as Record<MetricId, ReturnType<typeof metricPoints>>;
    for (const id of Object.keys(METRICS) as MetricId[]) out[id] = metricPoints(rides, METRICS[id]);
    return out;
  }, [rides]);

  const weeks = useMemo(() => weeklyVolume(rides, 12, now), [rides, now]);
  const streak = useMemo(() => weekStreak(rides, now), [rides, now]);
  const records = useMemo(() => personalRecords(rides), [rides]);

  if (!auth.user) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.scroll}>
          <NavBack inset={0} label="Back" testID="progress-back" />
          <LargeTitle inset={4}>Progress</LargeTitle>
          <View style={styles.card} testID="progress-locked">
            <Text style={styles.lockTitle}>See how you&apos;re improving</Text>
            {[
              'Hard-rep power and efficiency trends, ride over ride',
              'This month against last, in plain words',
              'Weekly time in HARD and your training streak',
              'Personal records, linked to the ride that set them',
            ].map((line) => (
              <View key={line} style={styles.bullet}>
                <View style={styles.dot} />
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
            <Text style={styles.lockNote}>
              {rides.length > 0
                ? `Your ${rides.length === 1 ? 'ride is' : `${rides.length} rides are`} already on this iPhone. Sign in and they back up and show up here.`
                : 'Free with an account. Your rides back up too.'}
            </Text>
            <Pill
              label={auth.busy === 'google' ? 'Opening…' : 'Continue with Google'}
              variant="light"
              onPress={() => void auth.signIn('google')}
              testID="progress-sign-in"
            />
          </View>
          {auth.needsSetup ? <Footer>Cloud is not set up on this install, so sign-in is off.</Footer> : null}
        </ScrollView>
      </Screen>
    );
  }

  if (rides.length === 0) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.scroll}>
          <NavBack inset={0} label="Back" testID="progress-back" />
          <LargeTitle inset={4}>Progress</LargeTitle>
          <View style={styles.card} testID="progress-empty">
            <Text style={styles.lockTitle}>Your progress starts with your first ride</Text>
            <Text style={styles.bulletText}>Finish a 30/15 session and your trends begin here.</Text>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const metric = METRICS[selected];
  const allPoints = series[selected];
  const smoothAll = rollingMean(allPoints, SMOOTH);
  const windowPoints = inPeriod(allPoints, period, now);
  const windowIds = new Set(windowPoints.map((p) => p.rideId + p.t));
  const windowSmooth = smoothAll.filter((p) => windowIds.has(p.rideId + p.t));
  const ridesInPeriod = inPeriod(rides.map((r) => ({ t: Date.parse(r.endedAt) })), period, now).length;

  const selectedDelta = periodDelta(allPoints, metric, period, now);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <NavBack inset={0} label="Back" testID="progress-back" />
        <LargeTitle inset={4}>Progress</LargeTitle>

        <View style={styles.periods} accessibilityRole="tablist">
          {PERIODS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setPeriod(p.id)}
              style={[styles.period, period === p.id && styles.periodOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: period === p.id }}
              testID={`period-${p.id}`}
            >
              <Text style={[styles.periodText, period === p.id && styles.periodTextOn]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.grid}>
          {TILES.map((id) => {
            const m = METRICS[id];
            const d = periodDelta(series[id], m, period, now);
            const on = selected === id;
            return (
              <Pressable
                key={id}
                onPress={() => setSelected(id)}
                style={[styles.tile, on && { borderColor: COLOR[id] }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                testID={`tile-${id}`}
              >
                <Text style={styles.tileLabel} numberOfLines={1}>
                  {m.label}
                </Text>
                {d ? (
                  <>
                    <Text style={styles.tileValue} numberOfLines={1}>
                      {d.current.toFixed(m.decimals)}
                      <Text style={styles.tileUnit}> {m.unit}</Text>
                    </Text>
                    <View style={styles.tileRow}>
                      <DeltaLine text={deltaText(d, m, null)} good={d.good} small />
                      <Sparkline values={series[id].map((p) => p.value)} color={COLOR[id]} width={56} height={20} />
                    </View>
                  </>
                ) : (
                  <Text style={styles.muted}>{series[id].length ? 'None in this period' : `Needs ${m.needs}`}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card} testID="progress-chart">
          <Text style={styles.tileLabel}>{metric.label} · average this period</Text>
          {selectedDelta ? (
            <>
              <Text style={styles.hero} testID="progress-hero">
                {selectedDelta.current.toFixed(metric.decimals)}
                <Text style={styles.heroUnit}> {metric.unit}</Text>
              </Text>
              <DeltaLine text={deltaText(selectedDelta, metric, prior)} good={selectedDelta.good} />
            </>
          ) : null}
          <Text style={[styles.muted, styles.rideCount]}>
            {ridesInPeriod} {ridesInPeriod === 1 ? 'ride' : 'rides'} in this period · {rides.length} total
          </Text>
          {windowPoints.length >= 2 ? (
            <TrendChart
              points={windowPoints}
              smooth={windowSmooth}
              color={COLOR[selected]}
              unit={metric.unit}
              decimals={metric.decimals}
              testID="trend-chart"
            />
          ) : (
            <Text style={styles.muted}>
              {allPoints.length === 0
                ? `Ride with ${metric.needs} to start this trend.`
                : 'Two rides in this period draw a trend. Try a longer range.'}
            </Text>
          )}
          {windowPoints.length >= 2 ? (
            <Text style={styles.legend}>Dots are single rides. The line is your {SMOOTH}-ride average.</Text>
          ) : null}
          <Text style={[styles.explain, styles.explainBelow]}>{metric.explain}</Text>
        </View>

        <View style={styles.card} testID="progress-weeks">
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Time in HARD, weekly</Text>
            <Text style={styles.streak}>{streak > 0 ? `${streak}-week streak` : 'No streak yet'}</Text>
          </View>
          <WeekBars weeks={weeks} color={ink.ember} />
        </View>

        {records.length ? (
          <View style={styles.card} testID="progress-records">
            <Text style={styles.cardTitle}>Personal records</Text>
            {records.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/history/${r.rideId}`)}
                style={({ pressed }) => [styles.record, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${r.label}: ${r.value} ${r.unit}, ${day(r.at)}`}
              >
                <View style={styles.recordText}>
                  <Text style={styles.recordLabel}>{r.label}</Text>
                  <Text style={styles.recordDate}>{day(r.at)}</Text>
                </View>
                <Text style={styles.recordValue}>
                  {r.value}
                  <Text style={styles.tileUnit}> {r.unit}</Text>
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Footer>
          Calculated on this iPhone from your {rides.length === 1 ? 'ride' : `${rides.length} rides`}. Power metrics need a power meter;
          efficiency and drift also need a heart-rate strap.
        </Footer>
      </ScrollView>
    </Screen>
  );
}

function DeltaLine({ text, good, small }: { text: string | null; good: boolean | null; small?: boolean }) {
  if (!text) return <Text style={[styles.muted, small && styles.small]}>Nothing earlier to compare</Text>;
  const color = good == null ? ink.secondary : good ? ink.signal : ink.danger;
  return <Text style={[styles.delta, small && styles.small, { color }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  periods: { flexDirection: 'row', ...surface.card, borderRadius: 21, padding: 3, marginTop: 12 },
  period: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 18, minHeight: 36, justifyContent: 'center' },
  periodOn: { backgroundColor: ink.raised },
  periodText: { color: ink.secondary, fontSize: 14, fontWeight: '600' },
  periodTextOn: { color: ink.text },
  card: { ...surface.card, borderRadius: radius.card - 2, padding: 18, marginTop: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { color: ink.text, ...type.headline, marginBottom: 4 },
  explain: { color: ink.secondary, ...type.caption, lineHeight: 17 },
  explainBelow: { marginTop: 12 },
  rideCount: { marginBottom: 14 },
  legend: { color: ink.tertiary, fontSize: 11, marginTop: 8 },
  hero: { color: ink.text, fontSize: 56, fontWeight: '600', letterSpacing: -1.5, marginTop: 2 },
  heroUnit: { color: ink.secondary, fontSize: 22, fontWeight: '500', letterSpacing: 0 },
  delta: { ...type.callout, fontWeight: '600', marginTop: 2 },
  small: { fontSize: 12, lineHeight: 16 },
  muted: { color: ink.secondary, ...type.caption, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  tile: {
    width: '48.4%',
    backgroundColor: ink.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 96,
  },
  tileLabel: { color: ink.secondary, ...type.caption },
  tileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  tileValue: { color: ink.text, fontSize: 24, fontWeight: '600', letterSpacing: -0.5, marginTop: 4 },
  tileUnit: { color: ink.secondary, fontSize: 13, fontWeight: '500', letterSpacing: 0 },
  streak: { color: ink.secondary, ...type.caption, fontWeight: '600' },
  record: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ink.hairline, minHeight: 44 },
  recordText: { flex: 1 },
  recordLabel: { color: ink.text, ...type.callout },
  recordDate: { color: ink.tertiary, fontSize: 12 },
  recordValue: { color: ink.text, fontSize: 18, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  lockTitle: { color: ink.text, ...type.title, fontSize: 24, marginBottom: 12 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ink.ember, marginTop: 8 },
  bulletText: { color: ink.secondary, ...type.callout, flex: 1 },
  lockNote: { color: ink.text, ...type.callout, marginVertical: 14 },
});
