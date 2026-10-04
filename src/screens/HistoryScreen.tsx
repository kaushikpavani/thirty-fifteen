import React, { useMemo } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { EMPTY_PHOTO } from '../content/photos';
import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Footer, Group, LargeTitle, NavBack, Row, SectionHeader } from '../components/kit/Grouped';
import { EffortTrace } from '../components/kit/EffortTrace';
import { useWorkout } from '../state/WorkoutContext';
import { useAuth } from '../auth/AuthContext';
import { tapHaptic } from '../components/kit/press';
import { useHistory } from '../state/HistoryContext';
import { ink, type } from '../theme/tokens';
import type { WorkoutRecord } from '../types';
import { clockText } from '../logic/rideView';
import { zoneMinutes, type TrendContext } from '../logic/trends';
import { observedMaxBpmFromHistory } from '../logic/vo2max';
import { useSettings } from '../state/SettingsContext';

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

/** When the ride started, in the rider's own clock style: "7:40 PM" or "19:40". */
export function rideTime(session: WorkoutRecord): string {
  return new Date(session.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function rideDetail(session: WorkoutRecord, ctx?: TrendContext): string {
  const s = session.summary;
  const zone = zoneMinutes(session, ctx);
  const parts = session.completed
    ? [s ? `${s.setsDone} ${s.setsDone === 1 ? 'set' : 'sets'}` : 'Full ride', clockText(session.durationMs)]
    : [`${clockText(session.durationMs)} ridden`];
  // What the ride was for comes first: minutes near VO2max, when a heart-rate monitor was on.
  if (zone != null) parts.push(`${clockText(Math.round(zone * 60_000))} near VO₂max`);
  if (s?.avgHardWatts != null) parts.push(`${s.avgHardWatts} W hard`);
  if (zone == null && s?.avgBpm != null) parts.push(`${s.avgBpm} bpm`);
  return parts.join(' · ');
}

/**
 * Deleting a ride is permanent, so it always asks first. Shared by the
 * list (press and hold) and the ride's own page.
 */
export function confirmDeleteRide(session: WorkoutRecord, signedIn: boolean, onDelete: () => void): void {
  Alert.alert(
    'Delete this ride?',
    `${dayTitle(session.endedAt)}, ${rideTime(session)}. This permanently removes it from this iPhone${signedIn ? ' and your cloud account' : ''}. It cannot be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete ride', style: 'destructive', onPress: onDelete },
    ],
  );
}

export function HistoryScreen() {
  const history = useHistory();
  const engine = useWorkout();
  const auth = useAuth();
  const groups = useMemo(() => groupSessions(history.sessions), [history.sessions]);
  const { settings } = useSettings();
  const ageYears = settings.ageYears ?? null;
  const ctx = useMemo(
    () => ({ observedMaxBpm: observedMaxBpmFromHistory(history.sessions), ageYears }),
    [history.sessions, ageYears],
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <NavBack label="Back" testID="history-back" />
        <LargeTitle>Past rides</LargeTitle>
        {history.cloudNote ? <Footer>{history.cloudNote}</Footer> : null}
        {groups.length === 0 ? (
          <View style={styles.empty}>
            {EMPTY_PHOTO ? (
              <View style={styles.emptyPhoto} accessibilityElementsHidden importantForAccessibility="no">
                <Image source={EMPTY_PHOTO.source} style={styles.emptyPhotoImage} resizeMode="cover" accessibilityIgnoresInvertColors />
                <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.0)', '#000']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
              </View>
            ) : null}
            <View style={styles.emptyTrace}>
              <EffortTrace segments={engine.state.workout.segments} height={84} />
            </View>
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
                    label={rideTime(session)}
                    detail={rideDetail(session, ctx)}
                    onPress={() => router.push(`/history/${session.id}`)}
                    onLongPress={() => {
                      tapHaptic('medium');
                      confirmDeleteRide(session, auth.user != null, () => {
                        void history.deleteSession(session.id).then((ok) => {
                          if (!ok) Alert.alert('Couldn’t delete that ride', 'Nothing was removed. Please try again.');
                        });
                      });
                    }}
                    accessibilityHint="Opens the ride. Press and hold to delete it."
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
        {groups.length > 0 ? <Footer>Press and hold a ride to delete it.</Footer> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 48 },
  empty: { alignItems: 'center', marginTop: 64, gap: 8, paddingHorizontal: 32 },
  emptyPhoto: { alignSelf: 'stretch', aspectRatio: 1.6, borderRadius: 24, overflow: 'hidden', marginBottom: 8 },
  emptyPhotoImage: { width: '100%', height: '100%' },
  emptyTrace: { alignSelf: 'stretch' },
  emptyTitle: { color: ink.text, ...type.headline, marginTop: 18 },
  emptyBody: { color: ink.secondary, ...type.callout, textAlign: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: ink.raised },
  badgeDone: { backgroundColor: 'rgba(50,215,75,0.16)' },
  badgeText: { color: ink.secondary, fontSize: 12, fontWeight: '600' },
  badgeTextDone: { color: ink.signal },
});
