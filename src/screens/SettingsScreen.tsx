import React, { useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { sensorStatus } from '../components/SensorChip';
import { useAuth } from '../auth/AuthContext';
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
import { colors } from '../theme/colors';
import type { WorkoutSettings } from '../types';
import { DEFAULT_SETTINGS, derivedWatts } from '../workout/defaults';

function Group({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function Hairline() {
  return <View style={styles.hairline} />;
}

function ChevronRow({
  label,
  value,
  onPress,
  testID,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable onPress={onPress} testID={testID} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowTrail}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityLabel="Decrease"
        onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        style={styles.stepHit}
      >
        <Text style={styles.stepGlyph}>−</Text>
      </Pressable>
      <View style={styles.stepSplit} />
      <Pressable
        accessibilityLabel="Increase"
        onPress={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
        style={styles.stepHit}
      >
        <Text style={styles.stepGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#3A3A3C', true: '#30D158' }}
        thumbColor={colors.white}
        testID={testID}
      />
    </View>
  );
}

export function SettingsScreen() {
  const { settings, update } = useSettings();
  const history = useHistory();
  const meter = usePowerMeter();
  const heart = useHeartRate();
  const auth = useAuth();
  const [dataNote, setDataNote] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [editor, setEditor] = useState<'ftp' | 'hard' | 'easy' | null>(null);
  const [draftValue, setDraftValue] = useState(settings.ftpWatts);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const patch = (partial: Partial<WorkoutSettings>) => {
    const prev = settingsRef.current;
    const next = { ...prev, ...partial };
    settingsRef.current = next;
    void update(next);
    if (auth.user && next.ftpWatts !== prev.ftpWatts) void syncProfile(auth.user);
  };

  const openEditor = (which: 'ftp' | 'hard' | 'easy') => {
    setDraftValue(which === 'ftp' ? settings.ftpWatts : which === 'hard' ? settings.hardPct : settings.easyPct);
    setEditor(which);
  };

  const saveEditor = () => {
    if (!editor) return;
    const next: Partial<WorkoutSettings> = {};
    if (editor === 'ftp') next.ftpWatts = Math.round(draftValue);
    if (editor === 'hard') next.hardPct = Math.round(draftValue);
    if (editor === 'easy') next.easyPct = Math.round(draftValue);
    patch(next);
    setEditor(null);
  };

  const resetSettings = async () => {
    await update({ ...DEFAULT_SETTINGS });
    setDataNote(settingsResetNote());
  };

  const deleteHistory = async () => {
    if (acting) return;
    setActing(true);
    try {
      const cloud = await history.clearSessions();
      setDataNote(historyDeleteNote(cloud));
    } finally {
      setActing(false);
    }
  };

  const clearQueues = async () => {
    if (acting) return;
    setActing(true);
    try {
      await clearQueuedOutboxes();
      setDataNote(outboxClearNote());
    } finally {
      setActing(false);
    }
  };

  const erasePhone = async () => {
    if (acting) return;
    setActing(true);
    try {
      await meter.forget();
      await heart.forget();
      const historyCloud = await history.clearSessions();
      const deviceCloud = await eraseThisDevice();
      await update({ ...DEFAULT_SETTINGS });
      await auth.setLocalName('');
      setDataNote(`${historyDeleteNote(historyCloud)} ${deviceEraseNote(deviceCloud)}`);
    } finally {
      setActing(false);
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This removes your cloud profile, sessions, analytics, and notes, then signs you out. Sessions still on this phone stay until you delete workout history. If the phone is offline, you stay signed in until the delete finishes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (acting) return;
              setActing(true);
              try {
                const cloud = await requestAccountDelete();
                setDataNote(accountDeleteNote(cloud));
              } finally {
                setActing(false);
              }
            })();
          },
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

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="settings-back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Group>
          <ChevronRow
            label="Power meter"
            value={sensorStatus(meter.connectionState, meter.live != null)}
            onPress={() => router.push('/power')}
            testID="open-power"
          />
        </Group>
        <Group>
          <ChevronRow
            label="Heart rate"
            value={sensorStatus(heart.connectionState, heart.live != null)}
            onPress={() => router.push('/heart')}
            testID="open-heart"
          />
        </Group>
        <Group>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Workout Sets</Text>
            <View style={styles.rowTrail}>
              <Text style={styles.setsValue}>{settings.sets}</Text>
              <Stepper
                value={settings.sets}
                min={1}
                max={6}
                onChange={(sets) => patch({ sets: Math.round(sets) })}
              />
            </View>
          </View>
        </Group>
        <Group>
          <Text style={styles.groupLabel}>Targets</Text>
          <Hairline />
          <ChevronRow label="FTP" value={`${settings.ftpWatts} W`} onPress={() => openEditor('ftp')} testID="edit-ftp" />
          <Hairline />
          <ChevronRow label="Hard" value={`${settings.hardPct} %`} onPress={() => openEditor('hard')} testID="edit-hard" />
          <Hairline />
          <ChevronRow label="Easy" value={`${settings.easyPct} %`} onPress={() => openEditor('easy')} testID="edit-easy" />
        </Group>

        <Text style={styles.section}>Session</Text>
        <Group>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Warm-up</Text>
            <View style={styles.rowTrail}>
              <Text style={styles.setsValue}>{settings.warmupMin} min</Text>
              <Stepper
                value={settings.warmupMin}
                min={5}
                max={30}
                onChange={(warmupMin) => patch({ warmupMin: Math.round(warmupMin) })}
              />
            </View>
          </View>
          <Hairline />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Reps</Text>
            <View style={styles.rowTrail}>
              <Text style={styles.setsValue}>{settings.reps}</Text>
              <Stepper
                value={settings.reps}
                min={4}
                max={20}
                onChange={(reps) => patch({ reps: Math.round(reps) })}
              />
            </View>
          </View>
          <Hairline />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Work</Text>
            <View style={styles.rowTrail}>
              <Text style={styles.setsValue}>{settings.workSec}s</Text>
              <Stepper
                value={settings.workSec}
                min={15}
                max={60}
                step={5}
                onChange={(workSec) => patch({ workSec: Math.round(workSec) })}
              />
            </View>
          </View>
          <Hairline />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Recover</Text>
            <View style={styles.rowTrail}>
              <Text style={styles.setsValue}>{settings.recoverSec}s</Text>
              <Stepper
                value={settings.recoverSec}
                min={10}
                max={30}
                step={5}
                onChange={(recoverSec) => patch({ recoverSec: Math.round(recoverSec) })}
              />
            </View>
          </View>
          <Hairline />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Between sets</Text>
            <View style={styles.rowTrail}>
              <Text style={styles.setsValue}>{settings.betweenSetRestMin} min</Text>
              <Stepper
                value={settings.betweenSetRestMin}
                min={1}
                max={10}
                onChange={(betweenSetRestMin) => patch({ betweenSetRestMin: Math.round(betweenSetRestMin) })}
              />
            </View>
          </View>
          <Hairline />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Cool-down</Text>
            <View style={styles.rowTrail}>
              <Text style={styles.setsValue}>{settings.cooldownMin} min</Text>
              <Stepper
                value={settings.cooldownMin}
                min={3}
                max={20}
                onChange={(cooldownMin) => patch({ cooldownMin: Math.round(cooldownMin) })}
              />
            </View>
          </View>
        </Group>

        <Text style={styles.section}>Ride</Text>
        <Group>
          <Toggle
            label="Music"
            value={settings.musicEnabled}
            onChange={(musicEnabled) => patch({ musicEnabled })}
            testID="music-toggle"
          />
          <Hairline />
          <Toggle
            label="Spoken cues"
            value={settings.speechEnabled}
            onChange={(speechEnabled) => patch({ speechEnabled })}
          />
          <Hairline />
          <Toggle
            label="Haptics"
            value={settings.hapticsEnabled}
            onChange={(hapticsEnabled) => patch({ hapticsEnabled })}
          />
          <Hairline />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Voice rate</Text>
            <View style={styles.rowTrail}>
              <Text style={styles.setsValue}>{settings.voiceRate.toFixed(2)}</Text>
              <Stepper
                value={settings.voiceRate}
                min={0.7}
                max={1.4}
                step={0.05}
                onChange={(voiceRate) => patch({ voiceRate: +voiceRate.toFixed(2) })}
              />
            </View>
          </View>
        </Group>

        <Text style={styles.section}>Library</Text>
        <Group>
          <ChevronRow label="Why 30/15" onPress={() => router.push('/about')} testID="open-about" />
          <Hairline />
          <ChevronRow label="Past sessions" onPress={() => router.push('/history')} testID="open-history" />
          <Hairline />
          <ChevronRow label="Leave a note" onPress={() => router.push('/feedback')} testID="settings-feedback" />
        </Group>

        <Text style={styles.section}>Account</Text>
        <Group>
          <View style={styles.block}>
            {auth.user ? (
              <>
                <Text style={styles.accountName}>{auth.user.name ?? 'Signed in'}</Text>
                <Text style={styles.accountMeta}>
                  {auth.user.provider}
                  {auth.user.email ? ` · ${auth.user.email}` : ''}
                </Text>
                <Text style={styles.accountMeta}>Sessions on this phone also sync while you are signed in.</Text>
                <PrimaryButton variant="hairline" label="Sign out" onPress={() => void auth.signOut()} testID="sign-out" />
              </>
            ) : (
              <>
                <Text style={styles.accountMeta}>Optional. Start never asks you to sign in.</Text>
                <PrimaryButton
                  variant="hairline"
                  label={auth.busy === 'google' ? 'Opening…' : 'Continue with Google'}
                  onPress={() => void auth.signIn('google')}
                  disabled={auth.busy != null}
                  testID="sign-in-google"
                />
                <PrimaryButton
                  variant="hairline"
                  label={auth.busy === 'facebook' ? 'Opening…' : 'Continue with Facebook'}
                  onPress={() => void auth.signIn('facebook')}
                  disabled={auth.busy != null}
                  testID="sign-in-facebook"
                />
                {auth.needsSetup ? (
                  <Text style={styles.accountMeta}>Cloud is not set up on this install. Sessions stay on this phone.</Text>
                ) : null}
              </>
            )}
            {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}
          </View>
        </Group>

        <Text style={styles.section}>Your data</Text>
        <Group>
          <View style={styles.block}>
            <Text style={styles.accountMeta}>
              Sessions, FTP, and notes live on this phone. You can delete them here. An account is optional and copies finished sessions when you are online. This coach is free.
            </Text>
            <PrimaryButton
              variant="hairline"
              label="Delete workout history"
              onPress={() => void deleteHistory()}
              disabled={acting}
              testID="delete-history"
            />
            <PrimaryButton
              variant="hairline"
              label="Clear queued notes and analytics"
              onPress={() => void clearQueues()}
              disabled={acting}
              testID="clear-outbox"
            />
            <PrimaryButton
              variant="hairline"
              label="Erase data on this phone"
              onPress={() => void erasePhone()}
              disabled={acting}
              testID="erase-device"
            />
            {auth.user ? (
              <PrimaryButton
                variant="danger"
                label="Delete account and cloud data"
                onPress={deleteAccount}
                disabled={acting}
                testID="delete-account"
              />
            ) : null}
            {dataNote ? <Text style={styles.accountMeta}>{dataNote}</Text> : null}
            <PrimaryButton variant="quiet" label="Reset defaults" onPress={() => void resetSettings()} testID="reset-settings" />
          </View>
        </Group>
      </ScrollView>

      <Modal visible={editor != null} transparent animationType="slide" onRequestClose={() => setEditor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditor(null)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{editorMeta.label}</Text>
          <Text style={styles.sheetValue}>
            {Math.round(draftValue)} {editorMeta.suffix}
          </Text>
          {editor === 'ftp' || editor === 'hard' || editor === 'easy' ? (
            <Text style={styles.sheetMeta}>
              Hard {preview.hard} W · Easy {preview.easy} W
            </Text>
          ) : null}
          <View style={styles.sheetStepper}>
            <Stepper
              value={draftValue}
              min={editorMeta.min}
              max={editorMeta.max}
              step={editorMeta.step}
              onChange={setDraftValue}
            />
          </View>
          <PrimaryButton label="Done" onPress={saveEditor} testID="save-target" />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  back: { color: '#0A84FF', fontSize: 17 },
  title: {
    color: colors.white,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 48, gap: 14, paddingTop: 18 },
  section: {
    marginTop: 8,
    marginLeft: 12,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  group: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  row: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: { color: colors.white, fontSize: 17, flexShrink: 1 },
  rowTrail: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowValue: { color: '#D1D1D6', fontSize: 17, fontVariant: ['tabular-nums'] },
  setsValue: { color: colors.white, fontSize: 17, fontVariant: ['tabular-nums'], minWidth: 28, textAlign: 'right' },
  chevron: { color: '#0A84FF', fontSize: 22, fontWeight: '500', marginTop: -2 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginLeft: 16 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#2C2C2E',
    overflow: 'hidden',
  },
  stepHit: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepSplit: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.18)' },
  stepGlyph: { color: colors.white, fontSize: 20, fontWeight: '500' },
  block: { padding: 16, gap: 10 },
  accountName: { color: colors.text, fontSize: 17, fontWeight: '600' },
  accountMeta: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetTitle: { color: colors.white, fontSize: 20, fontWeight: '700' },
  sheetValue: { color: colors.white, fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sheetMeta: { color: colors.textMuted, fontSize: 15 },
  sheetStepper: { alignItems: 'flex-start' },
});
