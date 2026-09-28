import React from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import { WHY_FOOTNOTE, WHY_SECTIONS, WHY_TITLE } from '../content/why3015';
import { WHY_PHOTO } from '../content/photos';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { ink, type } from '../theme/tokens';

/** Oxygen uptake through one set: 30/15 hugs the ceiling, long intervals sag in the rests. */
export function VO2Chart() {
  return (
    <View style={styles.chartCard} accessible accessibilityRole="image" accessibilityLabel="Oxygen uptake during one set. 30/15 stays near VO2max; long intervals fall away in each rest.">
      <View style={styles.chartHead}>
        <Text style={styles.chartMeta}>Oxygen uptake during one set</Text>
        <Text style={styles.chartMeta}>≈ 10 min</Text>
      </View>
      <Svg width="100%" height={118} viewBox="0 0 310 118" preserveAspectRatio="none">
        <Rect x={0} y={16} width={310} height={26} rx={6} fill="rgba(255,90,31,0.14)" />
        <SvgText x={0} y={10} fill="#FF8A55" fontSize={10} fontWeight="600" letterSpacing={1} fontFamily={Platform.OS === 'ios' ? 'System' : 'Helvetica, Arial, sans-serif'}>
          NEAR VO₂MAX
        </SvgText>
        <Path
          d="M0 110 C 40 70, 70 40, 98 30 L 128 28 C 142 58, 158 80, 176 84 C 200 62, 220 36, 246 30 L 268 29 C 282 58, 296 80, 310 84"
          fill="none"
          stroke="#6B6B70"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
        <Path
          d="M0 110 C 22 72, 42 40, 66 30 L 80 34 L 94 24 L 108 32 L 122 23 L 136 31 L 150 22 L 164 30 L 178 22 L 192 30 L 206 22 L 220 30 L 234 22 L 248 30 L 262 22 L 276 30 L 290 22 L 310 28"
          fill="none"
          stroke={ink.ember}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: ink.ember }]} />
          <Text style={styles.chartMeta}>30/15</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDash} />
          <Text style={styles.chartMeta}>Long intervals</Text>
        </View>
      </View>
    </View>
  );
}

function WhyBody() {
  return (
    <>
      {WHY_PHOTO ? (
        <View style={styles.photoWrap}>
          <Image source={WHY_PHOTO.source} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
          <Text style={styles.photoCredit}>{WHY_PHOTO.credit}</Text>
        </View>
      ) : null}
      <VO2Chart />
      <View style={styles.sections}>
        {WHY_SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>
              {s.body}
              {'cite' in s ? <Text style={styles.cite}> {s.cite}</Text> : null}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.foot}>{WHY_FOOTNOTE}</Text>
    </>
  );
}

type Props = { visible: boolean; onClose: () => void };

export function WhySheet({ visible, onClose }: Props) {
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet} testID="why-3015-sheet">
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {WHY_TITLE}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Done" testID="why-3015-close" style={styles.done}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.copy, { paddingBottom: insets.bottom + 28 }]} indicatorStyle="white">
          <WhyBody />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: '#141416' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: '#48484A', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 14 },
  title: { color: ink.text, ...type.title },
  done: { minHeight: 44, justifyContent: 'center' },
  doneText: { color: ink.emberText, fontSize: 17, fontWeight: '600' },
  copy: { paddingHorizontal: 24, paddingTop: 14 },
  photoWrap: { marginBottom: 14 },
  photo: { width: '100%', height: 190, borderRadius: 22, overflow: 'hidden' },
  photoCredit: { color: ink.tertiary, fontSize: 11, marginTop: 6 },
  chartCard: { backgroundColor: '#0B0B0C', borderRadius: 22, padding: 16, paddingBottom: 14 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  chartMeta: { color: ink.secondary, ...type.caption },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 14, height: 3, borderRadius: 2 },
  legendDash: { width: 14, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#6B6B70' },
  sections: { gap: 18, marginTop: 22 },
  section: { gap: 4 },
  sectionTitle: { color: ink.text, ...type.headline },
  sectionBody: { color: '#A8A8AE', fontSize: 15, lineHeight: 22 },
  cite: { color: ink.tertiary },
  foot: { color: ink.tertiary, ...type.caption, marginTop: 24 },
});
