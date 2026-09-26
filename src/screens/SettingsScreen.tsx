import React, { useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
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

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.bgSoft, true: colors.textDim }}
        thumbColor={value ? colors.white : colors.textMuted}
      />
    </View>
  );
}

export function SettingsScreen() {
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState(settings);
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
    router.back();
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

        <Text style={styles.section}>Structure</Text>
        <NumField label="Warm-up" value={draft.warmupMin} onChange={(n) => patch('warmupMin', Math.round(n))} suffix="min" min={5} max={30} />
        <NumField label="Sets" value={draft.sets} onChange={(n) => patch('sets', Math.round(n))} min={1} max={6} />
        <NumField label="Reps per set" value={draft.reps} onChange={(n) => patch('reps', Math.round(n))} min={4} max={20} />
        <NumField label="Work" value={draft.workSec} onChange={(n) => patch('workSec', Math.round(n))} suffix="sec" min={15} max={60} step={5} />
        <NumField label="Recover" value={draft.recoverSec} onChange={(n) => patch('recoverSec', Math.round(n))} suffix="sec" min={10} max={30} step={5} />
        <NumField label="Between-set rest" value={draft.betweenSetRestMin} onChange={(n) => patch('betweenSetRestMin', Math.round(n))} suffix="min" min={1} max={10} />
        <NumField label="Cool-down" value={draft.cooldownMin} onChange={(n) => patch('cooldownMin', Math.round(n))} suffix="min" min={3} max={20} />

        <Text style={styles.section}>Audio</Text>
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

        <PrimaryButton label="Save" onPress={() => void save()} testID="save-settings" />
        <PrimaryButton variant="quiet" label="Reset defaults" onPress={() => setDraft({ ...DEFAULT_SETTINGS })} />
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
  section: {
    marginTop: 18,
    color: colors.textDim,
    letterSpacing: 1.6,
    fontSize: 12,
    fontWeight: '600',
  },
  block: { gap: 10 },
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
