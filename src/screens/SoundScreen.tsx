import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Footer, Group, LargeTitle, NavBack, Row, SectionHeader, Toggle } from '../components/kit/Grouped';
import { Icon } from '../components/kit/Icon';
import { tapHaptic } from '../components/kit/Pill';
import { previewVoice } from '../audio/cues';
import { musicGenres, PULSE, resolveGenre } from '../audio/music';
import { COACH_LANGUAGES } from '../audio/coachLines';
import { coachLanguage, languageName, voiceName } from '../audio/voices';
import { useSettings } from '../state/SettingsContext';
import { ink, radius, type } from '../theme/tokens';
import type { CoachVoice, WorkoutSettings } from '../types';

const VOICES: { id: CoachVoice; detail: string }[] = [
  { id: 'female', detail: 'Female coach. Confident and warm.' },
  { id: 'male', detail: 'Male coach. Natural and down-to-earth.' },
  { id: 'off', detail: 'Ticks and haptics only.' },
];

/** A picture of Pulse: 16 bars that lift through HARD, 8 that breathe through EASY, a riser into the drop. */
function PulseWave() {
  const bars = useMemo(() => {
    const out: { h: number; c: string }[] = [];
    for (let i = 0; i < 72; i++) {
      const hard = i < 48;
      const env = hard ? 0.55 + 0.45 * (i / 48) : 0.35 - 0.15 * ((i - 48) / 24);
      const beat = i % 3 === 0 ? 1 : 0.62;
      let h = Math.max(4, Math.round(52 * env * beat * (0.8 + 0.2 * Math.sin(i * 1.7))));
      if (i >= 69) h = Math.round(10 + (i - 68) * 9);
      out.push({ h, c: hard ? ink.ember : i >= 69 ? '#FF8A55' : ink.glacier });
    }
    return out;
  }, []);
  return (
    <View style={styles.waveCard} accessible accessibilityRole="image" accessibilityLabel="Pulse: sixteen bars for hard, eight bars for easy">
      <View style={styles.wave}>
        {bars.map((b, i) => (
          <View key={i} style={{ flex: 1, height: b.h, borderRadius: 1, backgroundColor: b.c }} />
        ))}
      </View>
      <View style={styles.waveLegend}>
        <Text style={[styles.waveText, { flex: 2 }]}>HARD · 16 bars</Text>
        <Text style={[styles.waveText, { flex: 1 }]}>EASY · 8 bars</Text>
      </View>
    </View>
  );
}

function Segmented({ value, onChange }: { value: boolean; onChange: (pulse: boolean) => void }) {
  const options = [
    { pulse: true, label: 'On' },
    { pulse: false, label: 'Off' },
  ];
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.pulse === value;
        return (
          <Pressable
            key={o.label}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tapHaptic('light');
              onChange(o.pulse);
            }}
            style={[styles.segmentItem, on && styles.segmentOn]}
            testID={o.pulse ? 'music-pulse' : 'music-yours'}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SoundScreen() {
  const { settings, update } = useSettings();
  const ref = useRef(settings);
  useLayoutEffect(() => {
    ref.current = settings;
  });
  const patch = (partial: Partial<WorkoutSettings>) => {
    const next = { ...ref.current, ...partial };
    ref.current = next;
    void update(next);
  };
  const current: CoachVoice = settings.speechEnabled ? settings.coachVoice : 'off';

  const language = coachLanguage(settings);
  const genres = musicGenres();
  const genre = resolveGenre(settings.musicGenre);
  // Tapping the row steps to the next language; each one has its own female and male coach.
  const nextLanguage = () => {
    tapHaptic('light');
    const index = COACH_LANGUAGES.findIndex((entry) => entry.id === language);
    patch({ coachLanguage: COACH_LANGUAGES[(index + 1) % COACH_LANGUAGES.length]!.id });
  };

  const pick = (voice: CoachVoice) => {
    tapHaptic('light');
    if (voice === 'off') patch({ speechEnabled: false });
    else {
      patch({ speechEnabled: true, coachVoice: voice });
      void previewVoice(voice, ref.current);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <NavBack label="Settings" testID="sound-back" />
        <LargeTitle>Sound &amp; haptics</LargeTitle>

        <SectionHeader>Coach</SectionHeader>
        <Group>
          <Row
            label="Language"
            value={languageName(language)}
            testID="coach-language"
            onPress={COACH_LANGUAGES.length > 1 ? nextLanguage : undefined}
            chevron={false}
          />
        </Group>
        <View style={styles.gap} />
        <Group inset={50}>
          {VOICES.map((v) => (
            <Row
              key={v.id}
              label={voiceName(v.id, language)}
              detail={v.detail}
              onPress={() => pick(v.id)}
              chevron={false}
              testID={`voice-${v.id}`}
              accessibilityLabel={`${voiceName(v.id, language)}. ${v.detail}${current === v.id ? '. Selected' : ''}`}
              leading={
                <View style={styles.check}>{current === v.id ? <Icon name="check" size={18} color={ink.emberText} /> : null}</View>
              }
            />
          ))}
        </Group>
        <Footer>
          Tap a coach to hear them. One short line per rep at most, never over the count-in.
          {COACH_LANGUAGES.length > 1 ? '' : ' More languages are on the way.'}
        </Footer>

        <SectionHeader>Music</SectionHeader>
        <View style={styles.musicCard}>
          <Segmented value={settings.musicEnabled} onChange={(musicEnabled) => patch({ musicEnabled })} />
          {settings.musicEnabled && genre === PULSE ? <PulseWave /> : null}
        </View>
        {settings.musicEnabled && genres.length > 1 ? (
          <>
            <View style={styles.gap} />
            <Group inset={50}>
              {genres.map((g) => (
                <Row
                  key={g.id}
                  label={g.name}
                  onPress={() => {
                    tapHaptic('light');
                    patch({ musicGenre: g.id });
                  }}
                  chevron={false}
                  testID={`genre-${g.id}`}
                  accessibilityLabel={`${g.name}${genre === g.id ? '. Selected' : ''}`}
                  leading={<View style={styles.check}>{genre === g.id ? <Icon name="check" size={18} color={ink.emberText} /> : null}</View>}
                />
              ))}
            </Group>
          </>
        ) : null}
        <Footer>
          {!settings.musicEnabled
            ? 'No built-in music. Anything you are already playing carries on and dips under the coach.'
            : genre === PULSE
              ? 'Pulse runs at 128 BPM, so every hard rep is exactly 16 bars and every easy is 8. The drop lands on Go.'
              : 'A driving track for every HARD rep and a calmer one for EASY, warm-up and cool-down. Each picks up where it left off.'}
        </Footer>

        <SectionHeader>Cues</SectionHeader>
        <Group>
          {current !== 'off' ? (
            <Row
              label="Spoken count-in"
              detail="“Three, two, one, Go!” into every hard rep."
              trailing={<Toggle label="Spoken count-in" value={settings.spokenCount} onChange={(spokenCount) => patch({ spokenCount })} />}
            />
          ) : null}
          <Row
            label="Count-in ticks"
            trailing={<Toggle label="Count-in ticks" value={settings.beepsEnabled} onChange={(beepsEnabled) => patch({ beepsEnabled })} />}
          />
          <Row
            label="Haptics"
            trailing={<Toggle label="Haptics" value={settings.hapticsEnabled} onChange={(hapticsEnabled) => patch({ hapticsEnabled })} />}
          />
        </Group>
        <Footer>The iPhone silent switch never mutes a ride.</Footer>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: 12 },
  scroll: { paddingBottom: 48 },
  check: { width: 22, alignItems: 'center' },
  musicCard: { backgroundColor: ink.grouped, borderRadius: radius.group, marginHorizontal: 16, padding: 14, gap: 14 },
  segment: { flexDirection: 'row', backgroundColor: ink.raised, borderRadius: 10, padding: 2, height: 36 },
  segmentItem: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: '#636366' },
  segmentText: { color: ink.text, fontSize: 14, fontWeight: '500' },
  segmentTextOn: { fontWeight: '600' },
  waveCard: { backgroundColor: '#0B0B0C', borderRadius: 16, padding: 14 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 1.5, height: 56 },
  waveLegend: { flexDirection: 'row', marginTop: 8 },
  waveText: { color: ink.tertiary, ...type.caption, fontSize: 12 },
});
