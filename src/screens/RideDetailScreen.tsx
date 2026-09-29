import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../components/Screen';
import { doneStats, RepChart } from '../components/DoneSummary';
import { RepDualChart } from '../components/kit/RepDualChart';
import { Footer, LargeTitle, NavBack } from '../components/kit/Grouped';
import { Pill } from '../components/kit/Pill';
import { useAuth } from '../auth/AuthContext';
import { useHistory } from '../state/HistoryContext';
import { useSettings } from '../state/SettingsContext';
import { insightStats } from '../logic/rideSummary';
import { dayTitle } from './HistoryScreen';
import { ink, radius, type } from '../theme/tokens';
import { emailRideSummary } from '../logic/rideEmail';
import { shareRidePdf } from '../logic/rideShare';
import { shareSignInAlert } from '../logic/shareGate';
import { currentVo2Section } from '../logic/vo2max';

export function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const history = useHistory();
  const auth = useAuth();
  const { settings } = useSettings();
  const session = history.sessions.find((item) => item.id === id);

  if (!session) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.scroll}>
          <NavBack label="Past rides" testID="ride-detail-back" />
          <LargeTitle>Ride</LargeTitle>
          <Text style={styles.missing}>This ride is not on this iPhone anymore.</Text>
        </ScrollView>
      </Screen>
    );
  }

  const summary = session.summary;
  const reps = summary?.repWatts?.length ? summary.repWatts.length : 0;
  const stats = summary ? doneStats(summary) : [];
  const insights = summary ? insightStats(summary) : [];
  const repWatts = summary?.repWatts ?? [];
  const repBpm = summary?.repBpm ?? [];
  const hasDual = repBpm.length >= 2 && repWatts.length >= 2;
  const vo2 = currentVo2Section({
    ftpWatts: settings.ftpWatts,
    weightLb: settings.weightLb,
    ageYears: settings.ageYears,
    sex: settings.sex,
    restingHr: settings.restingHr,
    sessions: history.sessions,
  });

  const shareThisRide = () => {
    if (!summary) return;
    if (!auth.user) {
      const prompt = shareSignInAlert(auth);
      Alert.alert(prompt.title, prompt.message, prompt.buttons);
      return;
    }
    void shareRidePdf({ session, summary, vo2 });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <NavBack label="Past rides" testID="ride-detail-back" />
        <LargeTitle>{dayTitle(session.endedAt)}</LargeTitle>
        <Text style={styles.subtitle}>
          {session.completed ? 'Finished' : 'Ended early'} · FTP {session.ftpWatts} W
        </Text>

        {!summary ? (
          <Footer>This ride finished before per-rep stats were tracked, so only the basics are saved.</Footer>
        ) : null}

        {repWatts.length > 0 ? (
          <View style={styles.card} testID="ride-detail-power">
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{hasDual ? 'Power & heart rate, rep by rep' : 'Power, rep by rep'}</Text>
              <View style={styles.targetKey}>
                <View style={styles.targetDash} />
                <Text style={styles.cardMeta}>Target {session.hardWatts} W</Text>
              </View>
            </View>
            {hasDual ? (
              <RepDualChart watts={repWatts} bpm={repBpm} target={session.hardWatts} />
            ) : (
              <RepChart reps={repWatts} perSet={reps} target={session.hardWatts} />
            )}
          </View>
        ) : null}

        {stats.length > 0 ? (
          <View style={[styles.card, styles.grid]} testID="ride-detail-stats">
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
        ) : null}

        {insights.length > 0 ? (
          <View style={styles.card} testID="ride-detail-insights">
            <Text style={styles.cardTitle}>Efficiency & recovery</Text>
            {insights.map((s) => (
              <View key={s.label} style={styles.insightRow}>
                <View style={styles.insightHead}>
                  <Text style={styles.insightLabel}>{s.label}</Text>
                  <Text style={styles.insightValue}>
                    {s.value}
                    <Text style={styles.cellUnit}> {s.unit}</Text>
                  </Text>
                </View>
                <Text style={styles.insightExplain}>{s.explain}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {summary ? (
          <View style={styles.actions}>
            <Pill label="Share this ride" variant="quiet" icon="share" onPress={shareThisRide} testID="ride-detail-share" />
            {auth.user ? (
              <Pill
                label="Email this ride"
                variant="quiet"
                icon="mail"
                onPress={() => void emailRideSummary({ session, summary, user: auth.user!, vo2 })}
                testID="ride-detail-email"
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 48, gap: 0 },
  actions: { gap: 10, marginTop: 4 },
  subtitle: { color: ink.secondary, ...type.callout, marginTop: 4, marginBottom: 8 },
  missing: { color: ink.secondary, ...type.body, marginTop: 24, textAlign: 'center' },
  card: { backgroundColor: ink.surface, borderRadius: radius.card - 2, padding: 18, marginTop: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 },
  cardTitle: { color: ink.text, fontSize: 15, fontWeight: '600' },
  cardMeta: { color: ink.secondary, ...type.caption },
  targetKey: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  targetDash: { width: 12, borderTopWidth: 2, borderStyle: 'dashed', borderColor: ink.secondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 0, paddingVertical: 6 },
  cell: { width: '33.33%', paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  cellLabel: { color: ink.secondary, ...type.caption },
  cellValue: { color: ink.text, fontSize: 26, fontWeight: '600', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  cellUnit: { color: ink.secondary, fontSize: 14, fontWeight: '500', letterSpacing: 0 },
  insightRow: { marginTop: 12 },
  insightHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  insightLabel: { color: ink.text, fontSize: 15, fontWeight: '600' },
  insightValue: { color: ink.text, fontSize: 18, fontWeight: '600', ...type.tabular },
  insightExplain: { color: ink.secondary, ...type.caption, marginTop: 4, lineHeight: 17 },
});
