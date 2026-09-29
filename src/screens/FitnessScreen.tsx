import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Footer, Group, LargeTitle, NavBack, Row, SectionHeader, Stepper } from '../components/kit/Grouped';
import { Pill } from '../components/kit/Pill';
import { useHeartRate } from '../state/HeartRateContext';
import { useHistory } from '../state/HistoryContext';
import { useSettings } from '../state/SettingsContext';
import { ink, type } from '../theme/tokens';
import type { WorkoutSettings } from '../types';
import { observedMaxBpmFromHistory, vo2MaxCategory, vo2MaxEstimate, type Sex } from '../logic/vo2max';

type Editor = 'age' | 'weight' | 'restingHr' | null;

const EDITOR_META: Record<Exclude<Editor, null>, { label: string; suffix: string; min: number; max: number; step: number; key: keyof WorkoutSettings }> = {
  age: { label: 'Age', suffix: 'yr', min: 13, max: 99, step: 1, key: 'ageYears' },
  weight: { label: 'Weight', suffix: 'lb', min: 70, max: 400, step: 1, key: 'weightLb' },
  restingHr: { label: 'Resting heart rate', suffix: 'bpm', min: 30, max: 110, step: 1, key: 'restingHr' },
};

export function FitnessScreen() {
  const { settings, update } = useSettings();
  const history = useHistory();
  const heart = useHeartRate();
  const [editor, setEditor] = useState<Editor>(null);
  const [draft, setDraft] = useState(0);

  const observedMaxBpm = useMemo(() => observedMaxBpmFromHistory(history.sessions), [history.sessions]);

  const estimate = vo2MaxEstimate({
    ftpWatts: settings.ftpWatts,
    weightLb: settings.weightLb,
    ageYears: settings.ageYears,
    restingHr: settings.restingHr,
    observedMaxBpm,
  });
  const category = estimate ? vo2MaxCategory(estimate.value, settings.ageYears ?? null, settings.sex ?? null) : null;

  const openEditor = (which: Exclude<Editor, null>) => {
    const meta = EDITOR_META[which];
    const current = settings[meta.key] as number | null | undefined;
    setDraft(current ?? Math.round((meta.min + meta.max) / 2));
    setEditor(which);
  };

  const saveEditor = () => {
    if (!editor) return;
    const meta = EDITOR_META[editor];
    void update({ ...settings, [meta.key]: Math.round(draft) });
    setEditor(null);
  };

  const setSex = (sex: Sex) => void update({ ...settings, sex });

  const captureRestingHr = () => {
    if (heart.live?.bpm) void update({ ...settings, restingHr: Math.round(heart.live.bpm) });
  };

  const editorMeta = editor ? EDITOR_META[editor] : null;

  const sourceLabel =
    estimate?.source === 'blended'
      ? 'power and heart rate'
      : estimate?.source === 'power'
        ? 'power only'
        : 'heart rate only';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <NavBack label="Settings" testID="fitness-back" />
        <LargeTitle>Fitness</LargeTitle>

        {estimate ? (
          <View style={styles.card} testID="vo2-card">
            <Text style={styles.vo2Label}>Estimated VO₂max</Text>
            <View style={styles.vo2Row}>
              <Text style={styles.vo2Value}>{estimate.value.toFixed(1)}</Text>
              <Text style={styles.vo2Unit}>ml/kg/min</Text>
            </View>
            {category ? <Text style={styles.category}>{category} for your age and sex</Text> : null}
            <Text style={styles.range}>
              Likely between {estimate.low.toFixed(1)} and {estimate.high.toFixed(1)} — estimated from your {sourceLabel}, not measured in a lab.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.category}>Not enough data yet</Text>
            <Text style={styles.range}>
              Add your weight below (with your FTP already set in Targets), or your age and resting heart rate, and
              we&apos;ll estimate a VO₂max.
            </Text>
          </View>
        )}

        <SectionHeader>About you</SectionHeader>
        <Group>
          <Row label="Age" value={settings.ageYears ? `${settings.ageYears}` : 'Not set'} onPress={() => openEditor('age')} testID="edit-age" />
          <Row
            label="Sex"
            value={settings.sex ? (settings.sex === 'male' ? 'Male' : 'Female') : 'Not set'}
            trailing={
              <View style={styles.sexToggle}>
                <Pressable
                  onPress={() => setSex('male')}
                  style={[styles.sexBtn, settings.sex === 'male' && styles.sexBtnActive]}
                  testID="sex-male"
                >
                  <Text style={[styles.sexBtnText, settings.sex === 'male' && styles.sexBtnTextActive]}>M</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSex('female')}
                  style={[styles.sexBtn, settings.sex === 'female' && styles.sexBtnActive]}
                  testID="sex-female"
                >
                  <Text style={[styles.sexBtnText, settings.sex === 'female' && styles.sexBtnTextActive]}>F</Text>
                </Pressable>
              </View>
            }
            chevron={false}
          />
          <Row label="Weight" value={settings.weightLb ? `${settings.weightLb} lb` : 'Not set'} onPress={() => openEditor('weight')} testID="edit-weight" />
          <Row
            label="Resting heart rate"
            value={settings.restingHr ? `${settings.restingHr} bpm` : 'Not set'}
            onPress={() => openEditor('restingHr')}
            testID="edit-resting-hr"
          />
        </Group>
        {heart.live?.bpm ? (
          <>
            <Pill
              label={`Capture ${Math.round(heart.live.bpm)} bpm as resting now`}
              variant="quiet"
              icon="heart"
              onPress={captureRestingHr}
              testID="capture-resting-hr"
            />
            <Footer>Only works if you&apos;re actually resting — sit still for a minute first, then tap.</Footer>
          </>
        ) : (
          <Footer>Only used to estimate VO₂max. Never shared, never leaves this iPhone.</Footer>
        )}

        <SectionHeader>How this works</SectionHeader>
        <Footer>
          We estimate VO₂max the same way most fitness watches do in spirit — from your FTP relative to your weight,
          and from your heart rate relative to its resting and max values — but with our own published formulas, not
          any proprietary algorithm. It&apos;s a trend to watch over weeks, not a clinical measurement.
        </Footer>
      </ScrollView>

      <Modal visible={editor != null} transparent animationType="slide" onRequestClose={() => setEditor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditor(null)} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{editorMeta?.label}</Text>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetValue}>
              {Math.round(draft)}
              <Text style={styles.sheetSuffix}> {editorMeta?.suffix}</Text>
            </Text>
            {editorMeta ? (
              <Stepper
                label={editorMeta.label}
                onMinus={() => setDraft((v) => Math.max(editorMeta.min, v - editorMeta.step))}
                onPlus={() => setDraft((v) => Math.min(editorMeta.max, v + editorMeta.step))}
              />
            ) : null}
          </View>
          <Pill label="Done" variant="light" onPress={saveEditor} testID="save-fitness-field" />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  card: { backgroundColor: ink.surface, borderRadius: 18, padding: 20, marginTop: 12, marginBottom: 8 },
  vo2Label: { color: ink.secondary, ...type.caption },
  vo2Row: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  vo2Value: { color: ink.text, fontSize: 48, fontWeight: '600', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  vo2Unit: { color: ink.secondary, ...type.callout },
  category: { color: ink.glacier, ...type.headline, marginTop: 8 },
  range: { color: ink.secondary, ...type.caption, marginTop: 8, lineHeight: 17 },
  sexToggle: { flexDirection: 'row', gap: 6 },
  sexBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: ink.raised },
  sexBtnActive: { backgroundColor: ink.glacier },
  sexBtnText: { color: ink.secondary, fontWeight: '600' },
  sexBtnTextActive: { color: '#000' },
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
});
