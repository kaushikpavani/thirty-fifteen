import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Footer, Group, IconTile, LargeTitle, NavBack, Row, SectionHeader, Stepper } from '../components/kit/Grouped';
import { Pill } from '../components/kit/Pill';
import { useAuth } from '../auth/AuthContext';
import type { PowerConnectionState } from '../ble/cps';
import { useHistory } from '../state/HistoryContext';
import { useHeartRate } from '../state/HeartRateContext';
import { usePowerMeter } from '../state/PowerMeterContext';
import { syncProfile } from '../storage/cloud';
import { eraseThisDevice, requestAccountDelete, clearQueuedOutboxes } from '../storage/deletion';
import {
  accountDeleteNote,
  deviceEraseNote,
  historyDeleteNote,
  outboxClearNote,
  settingsResetNote,
} from '../storage/deletionState';
import { useSettings } from '../state/SettingsContext';
import { ink, type } from '../theme/tokens';
import type { WorkoutSettings } from '../types';
import { DEFAULT_SETTINGS, derivedWatts } from '../workout/defaults';
import { voiceName } from '../audio/voices';

export function sensorValue(state: PowerConnectionState, name: string | null): string {
  if (state === 'connected') return name ?? 'Connected';
  if (state === 'connecting') return 'Connecting';
  if (state === 'scanning') return 'Searching';
  if (state === 'bluetoothUnavailable') return 'Unavailable';
  return 'Not connected';
}

type Editor = 'ftp' | 'hard' | 'easy';

export function SettingsScreen() {
  const { settings, update } = useSettings();
  const history = useHistory();
  const meter = usePowerMeter();
  const heart = useHeartRate();
  const auth = useAuth();
  // A tap that can't do anything (no cloud project on this install, or the
  // provider rejected it) must still tell the rider something happened —
  // otherwise "Continue with Google" just looks broken. Fire once per
  // transition, not on every render.
  const sawNeedsSetup = useRef(false);
  useEffect(() => {
    if (auth.needsSetup && !sawNeedsSetup.current) {
      Alert.alert(
        'Sign-in unavailable',
        'This install has no 30/15 cloud project connected, so Google sign-in is off. Rides still save on this iPhone.',
      );
    }
    sawNeedsSetup.current = auth.needsSetup;
  }, [auth.needsSetup]);
  const lastAlertedError = useRef<string | null>(null);
  useEffect(() => {
    if (auth.error && auth.error !== lastAlertedError.current) {
      Alert.alert('Sign-in failed', auth.error);
    }
    lastAlertedError.current = auth.error;
  }, [auth.error]);
  const [dataNote, setDataNote] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draftValue, setDraftValue] = useState(settings.ftpWatts);
  const settingsRef = useRef(settings);
  useLayoutEffect(() => {
    settingsRef.current = settings;
  });

  const patch = (partial: Partial<WorkoutSettings>) => {
    const prev = settingsRef.current;
    const next = { ...prev, ...partial };
    settingsRef.current = next;
    void update(next);
    if (auth.user && next.ftpWatts !== prev.ftpWatts) void syncProfile(auth.user);
  };

  const step = (key: keyof WorkoutSettings, delta: number, min: number, max: number) => {
    const current = settingsRef.current[key] as number;
    patch({ [key]: Math.max(min, Math.min(max, Math.round(current + delta))) } as Partial<WorkoutSettings>);
  };

  const openEditor = (which: Editor) => {
    setDraftValue(which === 'ftp' ? settings.ftpWatts : which === 'hard' ? settings.hardPct : settings.easyPct);
    setEditor(which);
  };

  const saveEditor = () => {
    if (!editor) return;
    const next: Partial<WorkoutSettings> = {};
    if (editor === 'ftp') {
      next.ftpWatts = Math.round(draftValue);
      next.ftpSetByRider = true;
    }
    if (editor === 'hard') next.hardPct = Math.round(draftValue);
    if (editor === 'easy') next.easyPct = Math.round(draftValue);
    patch(next);
    setEditor(null);
  };

  const guard = async (work: () => Promise<void>) => {
    if (acting) return;
    setActing(true);
    try {
      await work();
    } finally {
      setActing(false);
    }
  };

  const resetSettings = async () => {
    await update({ ...DEFAULT_SETTINGS });
    setDataNote(settingsResetNote());
  };

  const runDeleteHistory = () =>
    guard(async () => {
      const cloud = await history.clearSessions();
      setDataNote(historyDeleteNote(cloud));
    });

  // Destructive and permanent: always confirm, never act on a single tap.
  const deleteHistory = () => {
    const count = history.sessions.length;
    Alert.alert(
      'Delete ride history?',
      `This permanently removes ${count === 1 ? 'your 1 ride' : `all ${count} rides`} from this iPhone${auth.user ? ' and your cloud account' : ''}. It cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete rides', style: 'destructive', onPress: () => void runDeleteHistory() },
      ],
    );
  };

  const clearQueues = () =>
    guard(async () => {
      await clearQueuedOutboxes();
      setDataNote(outboxClearNote());
    });

  const erasePhone = () => {
    Alert.alert(
      'Erase this iPhone?',
      'This permanently removes every ride, your settings, and saved sensors from this iPhone. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase', style: 'destructive', onPress: () => void runErasePhone() },
      ],
    );
  };

  const runErasePhone = () =>
    guard(async () => {
      await meter.forget();
      await heart.forget();
      const historyCloud = await history.clearSessions();
      const deviceCloud = await eraseThisDevice();
      await update({ ...DEFAULT_SETTINGS });
      await auth.setLocalName('');
      setDataNote(`${historyDeleteNote(historyCloud)} ${deviceEraseNote(deviceCloud)}`);
    });

  const deleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This removes your cloud profile, sessions, analytics, and notes, then signs you out. Sessions still on this phone stay until you delete workout history. If the phone is offline, you stay signed in until the delete finishes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () =>
            void guard(async () => {
              const cloud = await requestAccountDelete();
              setDataNote(accountDeleteNote(cloud));
            }),
        },
      ],
    );
  };

  const editorMeta =
    editor === 'ftp'
      ? { label: 'FTP', suffix: 'W', min: 50, max: 600, step: 5 }
      : editor === 'hard'
        ? { label: 'Hard', suffix: '%', min: 100, max: 200, step: 5 }
        : { label: 'Easy', suffix: '%', min: 20, max: 80, step: 5 };
  const previewFtp = editor === 'ftp' ? Math.round(draftValue) : settings.ftpWatts;
  const previewHard = editor === 'hard' ? Math.round(draftValue) : settings.hardPct;
  const previewEasy = editor === 'easy' ? Math.round(draftValue) : settings.easyPct;
  const preview = derivedWatts(previewFtp, previewHard, previewEasy);
  const watts = derivedWatts(settings.ftpWatts, settings.hardPct, settings.easyPct);
  const meterName = meter.phase.phase === 'connected' ? meter.phase.name : null;
  const heartName = heart.phase.phase === 'connected' ? heart.phase.name : null;
  const voice = settings.speechEnabled ? voiceName(settings.coachVoice) : 'Off';
  const music = settings.musicEnabled ? 'Pulse' : 'Your music';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <NavBack label="Home" testID="settings-back" />
        <LargeTitle>Settings</LargeTitle>

        <SectionHeader>Sensors</SectionHeader>
        <Group inset={58}>
          <Row
            label="Power meter"
            leading={<IconTile name="bolt" bg={ink.ember} fg="#000" />}
            value={sensorValue(meter.connectionState, meterName)}
            onPress={() => router.push('/power')}
            testID="open-power"
          />
          <Row
            label="Heart rate"
            leading={<IconTile name="heart" bg={ink.rose} />}
            value={sensorValue(heart.connectionState, heartName)}
            onPress={() => router.push('/heart')}
            testID="open-heart"
          />
        </Group>

        <SectionHeader>Fitness</SectionHeader>
        <Group inset={58}>
          <Row
            label="VO₂max estimate"
            leading={<IconTile name="target" bg={ink.glacier} fg="#000" />}
            onPress={() => router.push('/fitness')}
            testID="open-fitness"
          />
        </Group>

        <SectionHeader>Workout</SectionHeader>
        <Group>
          <Row
            label="Sets"
            value={String(settings.sets)}
            trailing={<Stepper label="sets" onMinus={() => step('sets', -1, 1, 6)} onPlus={() => step('sets', 1, 1, 6)} />}
          />
          <Row
            label="Reps per set"
            value={String(settings.reps)}
            trailing={<Stepper label="reps" onMinus={() => step('reps', -1, 4, 20)} onPlus={() => step('reps', 1, 4, 20)} />}
          />
          <Row
            label="Hard rep"
            value={`${settings.workSec} s`}
            trailing={<Stepper label="hard seconds" onMinus={() => step('workSec', -5, 15, 60)} onPlus={() => step('workSec', 5, 15, 60)} />}
          />
          <Row
            label="Easy rep"
            value={`${settings.recoverSec} s`}
            trailing={<Stepper label="easy seconds" onMinus={() => step('recoverSec', -5, 10, 30)} onPlus={() => step('recoverSec', 5, 10, 30)} />}
          />
          <Row
            label="Warm-up"
            value={`${settings.warmupMin} min`}
            trailing={<Stepper label="warm-up minutes" onMinus={() => step('warmupMin', -1, 5, 30)} onPlus={() => step('warmupMin', 1, 5, 30)} />}
          />
          <Row
            label="Rest between sets"
            value={`${settings.betweenSetRestMin} min`}
            trailing={
              <Stepper
                label="rest minutes"
                onMinus={() => step('betweenSetRestMin', -1, 1, 10)}
                onPlus={() => step('betweenSetRestMin', 1, 1, 10)}
              />
            }
          />
          <Row
            label="Cool-down"
            value={`${settings.cooldownMin} min`}
            trailing={<Stepper label="cool-down minutes" onMinus={() => step('cooldownMin', -1, 3, 20)} onPlus={() => step('cooldownMin', 1, 3, 20)} />}
          />
        </Group>
        <Footer>
          Each set is {settings.reps} reps of {settings.workSec} s hard, {settings.recoverSec} s easy.
        </Footer>

        <SectionHeader>Targets</SectionHeader>
        <Group>
          <Row label="FTP" value={`${settings.ftpWatts} W`} onPress={() => openEditor('ftp')} testID="edit-ftp" />
          <Row
            label="Hard"
            leading={<View style={[styles.dot, { backgroundColor: ink.ember }]} />}
            value={`${settings.hardPct}% · ${watts.hard} W`}
            onPress={() => openEditor('hard')}
            testID="edit-hard"
          />
          <Row
            label="Easy"
            leading={<View style={[styles.dot, { backgroundColor: ink.glacier }]} />}
            value={`${settings.easyPct}% · ${watts.easy} W`}
            onPress={() => openEditor('easy')}
            testID="edit-easy"
          />
        </Group>
        <Footer>Targets appear under your watts while you ride. Use a recent FTP test, or your best guess.</Footer>

        <SectionHeader>Sound</SectionHeader>
        <Group inset={58}>
          <Row
            label="Sound & haptics"
            leading={<IconTile name="wave" bg="#5E5CE6" />}
            value={`${voice} · ${music}`}
            onPress={() => router.push('/sound')}
            testID="open-sound"
          />
        </Group>

        <SectionHeader>Library</SectionHeader>
        <Group>
          <Row label="Past rides" onPress={() => router.push('/history')} testID="open-history" />
          <Row label="Progress" onPress={() => router.push('/progress')} testID="open-progress" />
          <Row label="Leave a note" onPress={() => router.push('/feedback')} testID="settings-feedback" />
          <Row label="Credits" onPress={() => router.push('/credits')} testID="open-credits" />
        </Group>

        <SectionHeader>Account</SectionHeader>
        {auth.user ? (
          <Group inset={58}>
            <Row
              label={auth.user.name ?? 'Signed in'}
              detail={`${auth.user.provider}${auth.user.email ? ` · ${auth.user.email}` : ''}`}
              leading={<IconTile name="person" bg="#3A3A3C" fg="#AEAEB2" />}
            />
            <Row label="Sign out" tint={ink.emberText} onPress={() => void auth.signOut()} chevron={false} testID="sign-out" />
          </Group>
        ) : (
          <Group>
            <Row
              label={auth.busy === 'google' ? 'Opening…' : 'Continue with Google'}
              tint={ink.emberText}
              onPress={() => void auth.signIn('google')}
              disabled={auth.busy != null}
              chevron={false}
              testID="sign-in-google"
            />
          </Group>
        )}
        <Footer>
          {auth.needsSetup && !auth.user
            ? 'Cloud is not set up on this install. Rides stay on this iPhone.'
            : history.cloudNote}
        </Footer>
        {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}

        <SectionHeader>Your data</SectionHeader>
        <Group>
          <Row label="Delete ride history" tint={ink.danger} onPress={() => void deleteHistory()} disabled={acting} chevron={false} testID="delete-history" />
          <Row label="Clear queued notes and analytics" tint={ink.danger} onPress={() => void clearQueues()} disabled={acting} chevron={false} testID="clear-outbox" />
          <Row label="Erase data on this iPhone" tint={ink.danger} onPress={() => void erasePhone()} disabled={acting} chevron={false} testID="erase-device" />
          {auth.user ? (
            <Row label="Delete account and cloud data" tint={ink.danger} onPress={deleteAccount} disabled={acting} chevron={false} testID="delete-account" />
          ) : null}
          <Row label="Reset to defaults" onPress={() => void resetSettings()} chevron={false} testID="reset-settings" />
        </Group>
        <Footer>{dataNote ?? 'Rides, FTP and notes live on this iPhone. An account only copies finished rides when you are online.'}</Footer>

        <Text style={styles.free}>30/15 is free. Forever.</Text>
      </ScrollView>

      <Modal visible={editor != null} transparent animationType="slide" onRequestClose={() => setEditor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditor(null)} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{editorMeta.label}</Text>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetValue}>
              {Math.round(draftValue)}
              <Text style={styles.sheetSuffix}> {editorMeta.suffix}</Text>
            </Text>
            <Stepper
              label={editorMeta.label}
              onMinus={() => setDraftValue((v) => Math.max(editorMeta.min, v - editorMeta.step))}
              onPlus={() => setDraftValue((v) => Math.min(editorMeta.max, v + editorMeta.step))}
            />
          </View>
          <Text style={styles.sheetMeta}>
            Hard {preview.hard} W · Easy {preview.easy} W
          </Text>
          <Pill label="Done" variant="light" onPress={saveEditor} testID="save-target" />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 48 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  error: { color: ink.danger, ...type.caption, paddingHorizontal: 32, marginTop: 6 },
  free: { color: '#636366', ...type.caption, textAlign: 'center', marginTop: 36 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: ink.grouped,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 16,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: '#48484A' },
  sheetTitle: { color: ink.secondary, ...type.headline },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetValue: { color: ink.text, fontSize: 56, fontWeight: '600', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  sheetSuffix: { fontSize: 22, color: ink.secondary, letterSpacing: 0 },
  sheetMeta: { color: ink.secondary, ...type.callout, fontVariant: ['tabular-nums'] },
});
