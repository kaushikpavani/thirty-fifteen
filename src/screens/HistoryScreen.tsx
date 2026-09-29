import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Footer, Group, LargeTitle, NavBack, Row, SectionHeader } from '../components/kit/Grouped';
import { BIKE_TONES, RoadBike } from '../components/bike/RoadBike';
import { useHistory } from '../state/HistoryContext';
import { ink, type } from '../theme/tokens';
import type { WorkoutRecord } from '../types';
import { clockText } from '../logic/rideView';

export function dayTitle(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(now) - start(date)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupSessions(sessions: WorkoutRecord[]) {
  const groups: { title: string; items: WorkoutRecord[] }[] = [];
  const sorted = sessions.slice().sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
  for (const session of sorted) {
    const title = dayTitle(session.endedAt);
    const last = groups[groups.length - 1];
    if (last?.title === title) last.items.push(session);
    else groups.push({ title, items: [session] });
  }
  return groups;
}

export function rideTitle(session: WorkoutRecord): string {
  if (!session.completed) return `${clockText(session.durationMs)} ridden`;
  return session.summary ? `${session.summary.setsDone} sets` : 'Full ride';
}

export function rideDetail(session: WorkoutRecord): string {
  const s = session.summary;
  const parts = session.completed ? [clockText(session.durationMs)] : [];
  if (s?.avgHardWatts != null) parts.push(`${s.avgHardWatts} W hard`);
  if (s?.avgBpm != null) parts.push(`${s.avgBpm} bpm`);
  parts.push(`FTP ${session.ftpWatts}`);
  return parts.join(' · ');
}

export function HistoryScreen() {
  const history = useHistory();
  const groups = useMemo(() => groupSessions(history.sessions), [history.sessions]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <NavBack label="Back" testID="history-back" />
        <LargeTitle>Past rides</LargeTitle>
        {history.cloudNote ? <Footer>{history.cloudNote}</Footer> : null}
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <RoadBike width={220} tone={BIKE_TONES.ember} wheelPeriodMs={2400} />
            <Text style={styles.emptyTitle}>No rides yet</Text>
            <Text style={styles.emptyBody}>Finish a ride and it shows up here.</Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.title}>
              <SectionHeader>{group.title}</SectionHeader>
              <Group>
                {group.items.map((session) => (
                  <Row
                    key={session.id}
                    label={rideTitle(session)}
                    detail={rideDetail(session)}
                    onPress={() => router.push(`/history/${session.id}`)}
                    testID={`history-ride-${session.id}`}
                    trailing={
                      <View style={[styles.badge, session.completed ? styles.badgeDone : null]}>
                        <Text style={[styles.badgeText, session.completed ? styles.badgeTextDone : null]}>
                          {session.completed ? 'Finished' : 'Ended early'}
                        </Text>
                      </View>
                    }
                  />
                ))}
              </Group>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 48 },
  empty: { alignItems: 'center', marginTop: 64, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { color: ink.text, ...type.headline, marginTop: 18 },
  emptyBody: { color: ink.secondary, ...type.callout, textAlign: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: ink.raised },
  badgeDone: { backgroundColor: 'rgba(50,215,75,0.16)' },
  badgeText: { color: ink.secondary, fontSize: 12, fontWeight: '600' },
  badgeTextDone: { color: ink.signal },
});
