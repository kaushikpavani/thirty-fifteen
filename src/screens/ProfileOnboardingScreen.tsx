import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Footer, Group, LargeTitle, Row, Stepper } from '../components/kit/Grouped';
import { Pill } from '../components/kit/Pill';
import { useSettings } from '../state/SettingsContext';
import { ink, type } from '../theme/tokens';
import type { WorkoutSettings } from '../types';
import type { Sex } from '../logic/vo2max';

type Editor = 'age' | 'weight' | null;

const EDITOR_META: Record<Exclude<Editor, null>, { label: string; suffix: string; min: number; max: number; step: number; key: keyof WorkoutSettings }> = {
  age: { label: 'Age', suffix: 'yr', min: 13, max: 99, step: 1, key: 'ageYears' },
  weight: { label: 'Weight', suffix: 'lb', min: 70, max: 400, step: 1, key: 'weightLb' },
};

/**
 * Shown once, right after a rider's first sign-in. Age, sex, and weight are
 * what unlock the VO2max estimate on the Fitness screen — asking for them
 * here, while there's a reason on screen to want it, beats hoping someone
 * finds Settings later. Entirely skippable, and never shown again either way.
 */
export function ProfileOnboardingScreen() {
  const { settings, update } = useSettings();
  const [editor, setEditor] = useState<Editor>(null);
  const [draft, setDraft] = useState(0);

  const finish = () => {
    void update({ ...settings, profilePromptSeen: true });
    router.back();
  };

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

  const editorMeta = editor ? EDITOR_META[editor] : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LargeTitle>A couple quick things</LargeTitle>
        <Footer>
          Your age, sex, and weight let us estimate a VO₂max for you on the Fitness screen — entirely optional, and you
          can fill these in or change them anytime in Settings instead.
        </Footer>

        <Group style={styles.group}>
          <Row label="Age" value={settings.ageYears ? `${settings.ageYears}` : 'Not set'} onPress={() => openEditor('age')} testID="onboarding-age" />
          <Row
            label="Sex"
            value={settings.sex ? (settings.sex === 'male' ? 'Male' : 'Female') : 'Not set'}
            trailing={
              <View style={styles.sexToggle}>
                <Pressable
                  onPress={() => setSex('male')}
                  style={[styles.sexBtn, settings.sex === 'male' && styles.sexBtnActive]}
                  testID="onboarding-sex-male"
                >
                  <Text style={[styles.sexBtnText, settings.sex === 'male' && styles.sexBtnTextActive]}>M</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSex('female')}
                  style={[styles.sexBtn, settings.sex === 'female' && styles.sexBtnActive]}
                  testID="onboarding-sex-female"
                >
                  <Text style={[styles.sexBtnText, settings.sex === 'female' && styles.sexBtnTextActive]}>F</Text>
                </Pressable>
              </View>
            }
            chevron={false}
          />
          <Row label="Weight" value={settings.weightLb ? `${settings.weightLb} lb` : 'Not set'} onPress={() => openEditor('weight')} testID="onboarding-weight" />
        </Group>

        <View style={styles.actions}>
          <Pill label="Save & continue" variant="light" onPress={finish} testID="onboarding-save" />
          <Pressable onPress={finish} accessibilityRole="button" testID="onboarding-skip" style={styles.skip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
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
          <Pill label="Done" variant="light" onPress={saveEditor} testID="save-onboarding-field" />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 24 },
  group: { marginTop: 16 },
  sexToggle: { flexDirection: 'row', gap: 6 },
  sexBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: ink.raised },
  sexBtnActive: { backgroundColor: ink.glacier },
  sexBtnText: { color: ink.secondary, fontWeight: '600' },
  sexBtnTextActive: { color: '#000' },
  actions: { marginTop: 28, gap: 14, alignItems: 'center' },
  skip: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: ink.secondary, ...type.callout },
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
