import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { useHistory } from '../state/HistoryContext';
import { colors } from '../theme/colors';
import type { WorkoutRecord } from '../types';
import { formatDuration } from '../workout/builder';

function dayTitle(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(now) - start(date)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function groupSessions(sessions: WorkoutRecord[]) {
  const groups: { title: string; items: WorkoutRecord[] }[] = [];
  for (const session of sessions) {
    const title = dayTitle(session.endedAt);
    const last = groups[groups.length - 1];
    if (last?.title === title) last.items.push(session);
    else groups.push({ title, items: [session] });
  }
  return groups;
}

export function HistoryScreen() {
  const history = useHistory();
  const groups = useMemo(() => groupSessions(history.sessions), [history.sessions]);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="history-back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>History</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {history.cloudNote ? <Text style={styles.note}>{history.cloudNote}</Text> : null}
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No sessions yet.</Text>
            <Text style={styles.emptyBody}>The leaderboard is empty.</Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text style={styles.day}>{group.title}</Text>
              {group.items.map((session) => (
                <View key={session.id} style={styles.row}>
                  <View>
                    <Text style={styles.duration}>{formatDuration(session.durationMs)}</Text>
                    <Text style={styles.meta}>FTP {session.ftpWatts}</Text>
                  </View>
                  <Text style={[styles.status, session.completed && { color: colors.done }]}>
                    {session.completed ? 'Complete' : `${session.completionPct}%`}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 18,
  },
  back: { color: colors.textMuted, fontSize: 16 },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '200',
    letterSpacing: -0.8,
  },
  scroll: { paddingHorizontal: 28, paddingBottom: 40, paddingTop: 12 },
  note: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  empty: { marginTop: 48, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '400' },
  emptyBody: { color: colors.textMuted, fontSize: 16 },
  group: { marginTop: 22 },
  day: {
    color: colors.textDim,
    fontSize: 12,
    letterSpacing: 1.4,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  duration: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  meta: { color: colors.textMuted, marginTop: 2, fontSize: 14 },
  status: { color: colors.textMuted, fontSize: 15 },
});
