import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { TipStrip } from '../components/TipStrip';
import { colors } from '../theme/colors';
import type { WorkoutSettings } from '../types';
import { sessionSummary } from '../workout/builder';
import { derivedWatts } from '../workout/defaults';

type Props = {
  settings: WorkoutSettings;
  onStart: () => void;
  onSettings: () => void;
  onAbout: () => void;
  onEditFtp: () => void;
};

export function HomeScreen({
  settings,
  onStart,
  onSettings,
  onAbout,
  onEditFtp,
}: Props) {
  const summary = sessionSummary(settings);
  const watts = derivedWatts(settings.ftpWatts, settings.hardPct, settings.easyPct);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0F1A22', colors.bg, '#0A1018']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>MICRO INTERVALS</Text>
              <Text style={styles.title}>30/15 Coach</Text>
            </View>
            <Pressable onPress={onSettings} style={styles.gear}>
              <Text style={styles.gearText}>⚙</Text>
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            Rønnestad-style bike coaching — hard 30s, easy 15s, spoken cues a
            beat early.
          </Text>

          <Pressable onPress={onEditFtp} style={styles.ftpCard}>
            <View style={styles.ftpTop}>
              <Text style={styles.ftpLabel}>YOUR FTP</Text>
              <Text style={styles.ftpEdit}>Edit</Text>
            </View>
            <Text style={styles.ftpValue}>{settings.ftpWatts} W</Text>
            <View style={styles.wattRow}>
              <View style={styles.wattBox}>
                <Text style={[styles.wattKind, { color: colors.hard }]}>HARD</Text>
                <Text style={styles.wattNum}>{watts.hard} W</Text>
                <Text style={styles.wattHint}>{settings.hardPct}% · above FTP</Text>
              </View>
              <View style={styles.wattBox}>
                <Text style={[styles.wattKind, { color: colors.easy }]}>EASY</Text>
                <Text style={styles.wattNum}>{watts.easy} W</Text>
                <Text style={styles.wattHint}>{settings.easyPct}% · light pressure</Text>
              </View>
            </View>
          </Pressable>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Session overview</Text>
            <Row label="Warm-up" value={`${settings.warmupMin} min + 3×10s accels`} />
            <Row
              label="Main"
              value={`${settings.sets}×${settings.reps} · ${settings.workSec}/${settings.recoverSec}s`}
            />
            <Row label="Between sets" value={`${settings.betweenSetRestMin} min easy`} />
            <Row label="Cool-down" value={`${settings.cooldownMin} min`} />
            <View style={styles.divider} />
            <Row label="Total time" value={`~${summary.totalMin} min`} bold />
          </View>

          <TipStrip />

          <PrimaryButton label="Start Workout" onPress={onStart} variant="orange" />

          <Pressable onPress={onAbout} style={styles.aboutLink}>
            <Text style={styles.aboutText}>About the science →</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && { color: colors.teal, fontWeight: '800' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40, gap: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: {
    color: colors.teal,
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    marginTop: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  gear: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearText: { fontSize: 22, color: colors.text },
  ftpCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  ftpTop: { flexDirection: 'row', justifyContent: 'space-between' },
  ftpLabel: {
    color: colors.orange,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontSize: 12,
  },
  ftpEdit: { color: colors.teal, fontWeight: '700' },
  ftpValue: { color: colors.text, fontSize: 42, fontWeight: '900' },
  wattRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  wattBox: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    borderRadius: 14,
    padding: 12,
    gap: 2,
  },
  wattKind: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  wattNum: { color: colors.text, fontSize: 22, fontWeight: '800' },
  wattHint: { color: colors.textDim, fontSize: 11 },
  summaryCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  aboutLink: { alignItems: 'center', paddingVertical: 8 },
  aboutText: { color: colors.teal, fontWeight: '700', fontSize: 15 },
});
