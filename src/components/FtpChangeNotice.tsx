import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFtpCheck } from '../hooks/useFtpCheck';
import { useSettings } from '../state/SettingsContext';
import { derivedWatts } from '../workout/defaults';
import { ink, radius, type, surface } from '../theme/tokens';

/** "FTP raised to 215 W" with the reason, Undo, and Got it. Shown until acknowledged. */
export function FtpChangeNotice({ testID = 'ftp-change' }: { testID?: string }) {
  const { settings } = useSettings();
  const { change, undoChange, ackChange } = useFtpCheck();
  if (!change) return null;
  const up = change.to > change.from;
  const w = derivedWatts(change.to, settings.hardPct, settings.easyPct);
  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.kicker}>FTP UPDATED</Text>
      <Text style={styles.title}>
        {up ? 'Raised' : 'Eased'} from {change.from} to {change.to} W
      </Text>
      <Text style={styles.body}>{change.reason}</Text>
      <Text style={styles.meta}>
        Next ride: HARD {w.hard} W · EASY {w.easy} W
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={undoChange} accessibilityRole="button" style={styles.btn} testID={`${testID}-undo`}>
          <Text style={styles.undo}>Undo</Text>
        </Pressable>
        <Pressable onPress={ackChange} accessibilityRole="button" style={styles.btn} testID={`${testID}-ok`}>
          <Text style={styles.ok}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...surface.card, borderRadius: radius.card - 2, padding: 18, marginTop: 12, borderWidth: 1, borderColor: ink.emberSoft },
  kicker: { color: ink.emberText, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: ink.text, ...type.headline, marginTop: 6 },
  body: { color: ink.secondary, ...type.callout, marginTop: 6 },
  meta: { color: ink.tertiary, ...type.caption, marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  btn: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  undo: { color: ink.secondary, ...type.callout },
  ok: { color: ink.emberText, ...type.callout, fontWeight: '600' },
});
