import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AuthSetupNote } from '../components/AuthSetupNote';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useAuth } from '../auth/AuthContext';
import { usePowerMeter } from '../state/PowerMeterContext';
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
  const auth = useAuth();
  const meter = usePowerMeter();
  const [draft, setDraft] = useState(settings);
  const [nameDraft, setNameDraft] = useState(auth.localName ?? '');
  const watts = useMemo(
    () => derivedWatts(draft.ftpWatts, draft.hardPct, draft.easyPct),
    [draft.ftpWatts, draft.hardPct, draft.easyPct],
  );

  const patch = <K extends keyof WorkoutSettings>(key: K, value: WorkoutSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    await update(draft);
    if (!auth.user) await auth.setLocalName(nameDraft);
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Account</Text>
        {auth.user ? (
          <View style={styles.block}>
            <Text style={styles.accountName}>{auth.user.name ?? 'Signed in'}</Text>
            <Text style={styles.accountMeta}>
              {auth.user.provider}
              {auth.user.email ? ` · ${auth.user.email}` : ''}
            </Text>
            <PrimaryButton variant="hairline" label="Sign out" onPress={() => void auth.signOut()} testID="sign-out" />
          </View>
        ) : (
          <View style={styles.block}>
            <PrimaryButton
              variant="hairline"
              label={auth.busy === 'google' ? 'Opening…' : 'Continue with Google'}
              onPress={() => void auth.signIn('google')}
              disabled={auth.busy != null}
            />
            <PrimaryButton
              variant="hairline"
              label={auth.busy === 'facebook' ? 'Opening…' : 'Continue with Facebook'}
              onPress={() => void auth.signIn('facebook')}
              disabled={auth.busy != null}
            />
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Your name"
              placeholderTextColor={colors.textDim}
              autoCapitalize="words"
              style={styles.nameInput}
            />
            {auth.needsSetup ? <AuthSetupNote /> : null}
          </View>
        )}
        {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}

        <Text style={styles.section}>Power meter</Text>
        <View style={styles.block}>
          <Text style={styles.accountName}>
            {meter.phase.phase === 'connected'
              ? meter.phase.name
              : meter.phase.phase === 'connecting'
                ? `Connecting ${meter.phase.name}`
                : meter.phase.phase === 'scanning'
                  ? 'Scanning'
                  : 'Not connected'}
          </Text>
          {meter.live ? (
            <Text style={styles.accountMeta} testID="settings-live-watts">
              {meter.live.watts} W
              {meter.live.speedKph != null ? ` · ${meter.live.speedKph.toFixed(1)} km/h` : ''}
            </Text>
          ) : (
            <Text style={styles.accountMeta}>
              {meter.phase.phase === 'connected'
                ? 'Waiting for a power packet.'
                : 'Live watts appear only from a real meter.'}
            </Text>
          )}
          {meter.phase.phase === 'scanning' || meter.phase.phase === 'list'
            ? meter.devices.map((device) => (
                <Pressable key={device.id} style={styles.device} onPress={() => meter.pick(device)}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.accountMeta}>{device.rssi != null ? `${device.rssi} dBm` : 'Tap to connect'}</Text>
                </Pressable>
              ))
            : null}
          {meter.gateCopy ? (
            <View>
              <Text style={styles.accountName}>{meter.gateCopy.title}</Text>
              <Text style={styles.accountMeta}>{meter.gateCopy.body}</Text>
              {meter.phase.phase === 'blocked' && meter.phase.detail ? (
                <Text style={styles.error}>{meter.phase.detail}</Text>
              ) : null}
            </View>
          ) : null}
          {meter.phase.phase === 'connected' ? (
            <PrimaryButton variant="hairline" label="Disconnect" onPress={() => void meter.disconnect()} testID="disconnect-power" />
          ) : (
            <PrimaryButton
              variant="hairline"
              label={meter.phase.phase === 'scanning' ? 'Scanning…' : 'Connect'}
              onPress={meter.connect}
              disabled={meter.phase.phase === 'scanning' || meter.phase.phase === 'connecting'}
              testID="connect-power"
            />
          )}
          {meter.phase.phase !== 'idle' && meter.phase.phase !== 'connected' ? (
            <Pressable onPress={meter.dismiss}>
              <Text style={styles.back}>Close</Text>
            </Pressable>
          ) : null}
        </View>

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
        <Toggle label="Beep tones" value={draft.beepsEnabled} onChange={(v) => patch('beepsEnabled', v)} />
        <Toggle label="Haptics" value={draft.hapticsEnabled} onChange={(v) => patch('hapticsEnabled', v)} />
        <NumField label="Cue lead" value={draft.cueLeadMs} onChange={(n) => patch('cueLeadMs', Math.round(n))} suffix="ms" min={400} max={1500} step={100} />

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
