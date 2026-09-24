import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import type { WorkoutSettings } from '../types';
import { DEFAULT_SETTINGS, derivedWatts } from '../workout/defaults';

type Props = {
  settings: WorkoutSettings;
  onChange: (next: WorkoutSettings) => void;
  onBack: () => void;
};

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
        <Pressable
          style={styles.stepBtn}
          onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <TextInput
          style={styles.fieldInput}
          keyboardType="decimal-pad"
          value={String(value)}
          onChangeText={(t) => {
            const n = parseFloat(t.replace(/[^0-9.]/g, ''));
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        <Pressable
          style={styles.stepBtn}
          onPress={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function SettingsScreen({ settings, onChange, onBack }: Props) {
  const [draft, setDraft] = useState(settings);
  const watts = useMemo(
    () => derivedWatts(draft.ftpWatts, draft.hardPct, draft.easyPct),
    [draft.ftpWatts, draft.hardPct, draft.easyPct],
  );

  const patch = <K extends keyof WorkoutSettings>(key: K, value: WorkoutSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const save = () => {
    onChange(draft);
    onBack();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={onBack}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Settings</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
          <View style={styles.derived}>
            <Text style={styles.derivedTitle}>Derived targets</Text>
            <Text style={styles.derivedLine}>
              HARD {draft.hardPct}% → <Text style={{ color: colors.hard }}>{watts.hard} W</Text> (above FTP)
            </Text>
            <Text style={styles.derivedLine}>
              EASY {draft.easyPct}% → <Text style={{ color: colors.easy }}>{watts.easy} W</Text> (light pressure)
            </Text>
          </View>
          <NumField
            label="Hard % of FTP"
            value={draft.hardPct}
            onChange={(n) => patch('hardPct', Math.round(n))}
            suffix="%"
            min={100}
            max={200}
            step={5}
          />
          <NumField
            label="Easy % of FTP"
            value={draft.easyPct}
            onChange={(n) => patch('easyPct', Math.round(n))}
            suffix="%"
            min={20}
            max={80}
            step={5}
          />

          <Text style={styles.section}>Structure</Text>
          <NumField label="Warm-up" value={draft.warmupMin} onChange={(n) => patch('warmupMin', Math.round(n))} suffix="min" min={5} max={30} />
          <NumField label="Sets" value={draft.sets} onChange={(n) => patch('sets', Math.round(n))} min={1} max={6} />
          <NumField label="Reps per set" value={draft.reps} onChange={(n) => patch('reps', Math.round(n))} min={4} max={20} />
          <NumField label="Work (HARD)" value={draft.workSec} onChange={(n) => patch('workSec', Math.round(n))} suffix="sec" min={15} max={60} step={5} />
          <NumField label="Recover (EASY)" value={draft.recoverSec} onChange={(n) => patch('recoverSec', Math.round(n))} suffix="sec" min={10} max={30} step={5} />
          <NumField label="Between-set rest" value={draft.betweenSetRestMin} onChange={(n) => patch('betweenSetRestMin', Math.round(n))} suffix="min" min={1} max={10} />
          <NumField label="Cool-down" value={draft.cooldownMin} onChange={(n) => patch('cooldownMin', Math.round(n))} suffix="min" min={3} max={20} />

          <Text style={styles.section}>Audio & feel</Text>
          <Toggle
            label="Spoken cues"
            value={draft.speechEnabled}
            onChange={(v) => patch('speechEnabled', v)}
          />
          <NumField
            label="Voice rate"
            value={draft.voiceRate}
            onChange={(n) => patch('voiceRate', n)}
            min={0.7}
            max={1.4}
            step={0.05}
          />
          <Toggle
            label="Beep tones"
            value={draft.beepsEnabled}
            onChange={(v) => patch('beepsEnabled', v)}
          />
          <Toggle
            label="Haptics on phase change"
            value={draft.hapticsEnabled}
            onChange={(v) => patch('hapticsEnabled', v)}
          />
          <NumField
            label="Cue lead time"
            value={draft.cueLeadMs}
            onChange={(n) => patch('cueLeadMs', Math.round(n))}
            suffix="ms"
            min={400}
            max={1500}
            step={100}
          />

          <PrimaryButton label="Save settings" onPress={save} variant="orange" />
          <PrimaryButton
            label="Reset defaults"
            onPress={() => setDraft({ ...DEFAULT_SETTINGS })}
            variant="secondary"
            size="md"
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.tealDim }}
        thumbColor={value ? colors.teal : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  back: { color: colors.teal, fontWeight: '700', fontSize: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  scroll: { padding: 20, gap: 12, paddingBottom: 48 },
  section: {
    color: colors.orange,
    fontWeight: '800',
    letterSpacing: 1.3,
    fontSize: 12,
    marginTop: 10,
  },
  field: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  fieldLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 6,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepText: { color: colors.text, fontSize: 24, fontWeight: '700' },
  suffix: { color: colors.textDim, fontWeight: '700', width: 36 },
  derived: {
    backgroundColor: colors.tealSoft,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  derivedTitle: { color: colors.teal, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  derivedLine: { color: colors.text, fontSize: 15, fontWeight: '600' },
  toggleRow: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
