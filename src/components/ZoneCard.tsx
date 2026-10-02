import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useHistory } from '../state/HistoryContext';
import { useSettings } from '../state/SettingsContext';
import { observedMaxBpmFromHistory } from '../logic/vo2max';
import { zoneCopy, zoneResult, type ZoneLevel } from '../logic/zone';
import { ink, radius, surface, type } from '../theme/tokens';
import type { RideSummary } from '../types';

const LEVEL_COLOR: Record<ZoneLevel, string> = {
  reached: ink.signal,
  close: ink.glacier,
  touched: ink.secondary,
  missed: ink.secondary,
};

/**
 * The answer to "did this ride do its job?": how long the rider spent near
 * VO2max, against a goal, in one glance. Falls back to reps on target with
 * power only, and to an honest "no sensor" without either.
 */
export function ZoneCard({ summary, hardTarget, testID }: { summary: RideSummary; hardTarget: number | null; testID?: string }) {
  const history = useHistory();
  const { settings } = useSettings();
  const result = useMemo(
    () =>
      zoneResult({
        summary,
        observedMaxBpm: observedMaxBpmFromHistory(history.sessions),
        ageYears: settings.ageYears ?? null,
        hardTarget,
      }),
    [summary, history.sessions, settings.ageYears, hardTarget],
  );
  const copy = zoneCopy(result);
  const tone = result.kind === 'hr' ? LEVEL_COLOR[result.level] : ink.secondary;
  const reached = result.kind === 'hr' && result.level === 'reached';

  return (
    <View
      style={[styles.card, reached && styles.cardReached]}
      testID={testID}
      accessible
      accessibilityLabel={`${copy.kicker}. ${copy.headline}. ${copy.verdict}. ${copy.body}`}
    >
      <Text style={styles.kicker}>{copy.kicker}</Text>
      <View style={styles.row}>
        <Text style={styles.headline}>{copy.headline}</Text>
        <View style={[styles.badge, { borderColor: tone }]}>
          <Text style={[styles.badgeText, { color: tone }]}>{copy.verdict}</Text>
        </View>
      </View>
      {copy.progress != null ? (
        <View style={styles.meter}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(2, copy.progress * 100)}%`, backgroundColor: reached ? ink.signal : ink.ember }]} />
          </View>
          {copy.goalLabel ? <Text style={styles.goal}>{copy.goalLabel}</Text> : null}
        </View>
      ) : null}
      <Text style={styles.body}>{copy.body}</Text>
      {result.kind === 'none' ? (
        <Text style={styles.link} onPress={() => router.push('/sensors')} accessibilityRole="link">
          What can I connect?
        </Text>
      ) : null}
      {copy.footnote ? <Text style={styles.footnote}>{copy.footnote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...surface.card, borderRadius: radius.card - 2, padding: 18, marginTop: 12 },
  cardReached: { borderColor: 'rgba(50,215,75,0.35)' },
  kicker: { color: ink.tertiary, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 12 },
  headline: { color: ink.text, fontSize: 44, lineHeight: 48, fontWeight: '700', letterSpacing: -1.2, ...type.tabular },
  badge: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 1 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: ink.raised, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  goal: { color: ink.secondary, ...type.caption, ...type.tabular },
  body: { color: ink.secondary, ...type.callout, marginTop: 12 },
  link: { color: ink.emberText, ...type.callout, fontWeight: '600', marginTop: 8 },
  footnote: { color: ink.tertiary, fontSize: 11, lineHeight: 15, marginTop: 10 },
});
