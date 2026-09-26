import React, { useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { PowerMeterPanel } from '../components/PowerMeterPanel';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useAuth } from '../auth/AuthContext';
import { useHistory } from '../state/HistoryContext';
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

function NumField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  max = 9999,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <TextInput
          style={styles.fieldInput}
          keyboardType="decimal-pad"
          value={String(value)}
          onChangeText={(raw) => {
            const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        <Pressable style={styles.stepBtn} onPress={() => onChange(Math.min(max, +(value + step).toFixed(2)))}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
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
    <View style={styles.toggleRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.bgSoft, true: colors.textDim }}
        thumbColor={value ? colors.white : colors.textMuted}
        testID={testID}
      />
    </View>
  );
}

export function SettingsScreen() {
  const { settings, update } = useSettings();
  const history = useHistory();
  const meter = usePowerMeter();
  const auth = useAuth();
  const [draft, setDraft] = useState(settings);
  const [dataNote, setDataNote] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const watts = useMemo(
    () => derivedWatts(draft.ftpWatts, draft.hardPct, draft.easyPct),
    [draft.ftpWatts, draft.hardPct, draft.easyPct],
  );

  const patch = <K extends keyof WorkoutSettings>(key: K, value: WorkoutSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    Keyboard.dismiss();
    await update(draft);
    if (auth.user) void syncProfile(auth.user);
    router.back();
  };

  const resetSettings = async () => {
    const next = { ...DEFAULT_SETTINGS };
    setDraft(next);
    await update(next);
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
      const historyCloud = await history.clearSessions();
      const deviceCloud = await eraseThisDevice();
      const next = { ...DEFAULT_SETTINGS };
      setDraft(next);
      await update(next);
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

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="settings-back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Text style={styles.section}>Power</Text>
        <NumField
          label="FTP"
          value={draft.ftpWatts}
          onChange={(n) => patch('ftpWatts', Math.round(n))}
          suffix="W"
          min={50}
          max={600}
          step={5}
        />
        <Text style={styles.derived}>
          Hard {draft.hardPct}% → {watts.hard} W · Easy {draft.easyPct}% → {watts.easy} W
        </Text>
        <NumField label="Hard % of FTP" value={draft.hardPct} onChange={(n) => patch('hardPct', Math.round(n))} suffix="%" min={100} max={200} step={5} />
        <NumField label="Easy % of FTP" value={draft.easyPct} onChange={(n) => patch('easyPct', Math.round(n))} suffix="%" min={20} max={80} step={5} />

        <Text style={styles.section}>Power meter</Text>
        <PowerMeterPanel variant="settings" />

        <Text style={styles.section}>Structure</Text>
        <NumField label="Warm-up" value={draft.warmupMin} onChange={(n) => patch('warmupMin', Math.round(n))} suffix="min" min={5} max={30} />
        <NumField label="Sets" value={draft.sets} onChange={(n) => patch('sets', Math.round(n))} min={1} max={6} />
        <NumField label="Reps per set" value={draft.reps} onChange={(n) => patch('reps', Math.round(n))} min={4} max={20} />
        <NumField label="Work" value={draft.workSec} onChange={(n) => patch('workSec', Math.round(n))} suffix="sec" min={15} max={60} step={5} />
        <NumField label="Recover" value={draft.recoverSec} onChange={(n) => patch('recoverSec', Math.round(n))} suffix="sec" min={10} max={30} step={5} />
        <NumField label="Between-set rest" value={draft.betweenSetRestMin} onChange={(n) => patch('betweenSetRestMin', Math.round(n))} suffix="min" min={1} max={10} />
        <NumField label="Cool-down" value={draft.cooldownMin} onChange={(n) => patch('cooldownMin', Math.round(n))} suffix="min" min={3} max={20} />

        <Text style={styles.section}>Audio</Text>
        <Toggle label="Music" value={draft.musicEnabled} onChange={(v) => patch('musicEnabled', v)} testID="music-toggle" />
        <Toggle label="Spoken cues" value={draft.speechEnabled} onChange={(v) => patch('speechEnabled', v)} />
        <NumField label="Voice rate" value={draft.voiceRate} onChange={(n) => patch('voiceRate', n)} min={0.7} max={1.4} step={0.05} />
        <Toggle label="Haptics" value={draft.hapticsEnabled} onChange={(v) => patch('hapticsEnabled', v)} />

        <Text style={styles.section}>The session</Text>
        <Pressable onPress={() => router.push('/about')} testID="open-about">
          <Text style={styles.accountName}>Why 30/15</Text>
          <Text style={styles.accountMeta}>Hard is about 120% of FTP. Easy is about half.</Text>
        </Pressable>

        <Text style={styles.section}>History</Text>
        <Pressable onPress={() => router.push('/history')} testID="open-history">
          <Text style={styles.accountName}>Past sessions</Text>
        </Pressable>

        <Text style={styles.section}>Feedback</Text>
        <Pressable onPress={() => router.push('/feedback')} testID="settings-feedback">
          <Text style={styles.accountName}>Leave a note</Text>
          <Text style={styles.accountMeta}>Optional. Praise, complaints, or the feature you want.</Text>
        </Pressable>

        <Text style={styles.section}>Account</Text>
        {auth.user ? (
          <View style={styles.block}>
            <Text style={styles.accountName}>{auth.user.name ?? 'Signed in'}</Text>
            <Text style={styles.accountMeta}>
              {auth.user.provider}
              {auth.user.email ? ` · ${auth.user.email}` : ''}
            </Text>
            <Text style={styles.accountMeta}>Sessions on this phone also sync while you are signed in.</Text>
            <PrimaryButton variant="hairline" label="Sign out" onPress={() => void auth.signOut()} testID="sign-out" />
          </View>
        ) : (
          <View style={styles.block}>
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
          </View>
        )}
        {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}

        <Text style={styles.section}>Your data</Text>
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
        </View>

        <PrimaryButton label="Save" onPress={() => void save()} testID="save-settings" />
        <PrimaryButton variant="quiet" label="Reset defaults" onPress={() => void resetSettings()} testID="reset-settings" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 28, paddingTop: 8, gap: 18 },
  back: { color: colors.textMuted, fontSize: 16 },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '200',
    letterSpacing: -0.8,
  },
  scroll: { paddingHorizontal: 28, paddingBottom: 48, gap: 12 },
  block: { gap: 10 },
  section: {
    marginTop: 18,
    color: colors.textDim,
    letterSpacing: 1.6,
    fontSize: 12,
    fontWeight: '600',
  },
  accountName: { color: colors.text, fontSize: 20, fontWeight: '400' },
  accountMeta: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  nameInput: {
    color: colors.text,
    fontSize: 17,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  error: { color: colors.danger, fontSize: 14 },
  device: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  deviceName: { color: colors.text, fontSize: 16 },
  derived: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  field: {
    paddingVertical: 8,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  fieldLabel: { color: colors.textMuted, fontSize: 14 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: '400',
    textAlign: 'center',
    paddingVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.text, fontSize: 24 },
  suffix: { color: colors.textDim, width: 36 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
