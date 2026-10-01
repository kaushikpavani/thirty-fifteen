import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFtpCheck } from '../hooks/useFtpCheck';
import { useSettings } from '../state/SettingsContext';
import { derivedWatts } from '../workout/defaults';
import { ink, radius, type } from '../theme/tokens';
import { Pill } from './kit/Pill';

/**
 * Manual mode, after a ride: "your rides say FTP should move — want to?"
 * Shown when two of the last three rides agree; applied only on a tap.
 * (In auto mode the change is already applied and FtpChangeNotice shows it.)
 */
export function FtpCheckCard({ testID = 'ftp-check' }: { testID?: string }) {
  const { settings } = useSettings();
  const { suggestion, accept, dismiss, auto } = useFtpCheck();
  const [done, setDone] = useState<number | null>(null);

  if (done != null) {
    const w = derivedWatts(done, settings.hardPct, settings.easyPct);
    return (
      <View style={styles.card} testID={`${testID}-done`}>
        <Text style={styles.title}>FTP set to {done} W</Text>
        <Text style={styles.body}>
          Next ride: HARD {w.hard} W, EASY {w.easy} W. You can change it any time in Settings.
        </Text>
      </View>
    );
  }
  if (!suggestion || auto) return null;

  const up = suggestion.direction === 'raise';
  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.kicker}>FTP CHECK</Text>
      <Text style={styles.title}>
        {up ? 'Ready for harder targets' : 'Targets look a bit too hard'}: {suggestion.from} → {suggestion.to} W
      </Text>
      <Text style={styles.body}>{suggestion.reason}</Text>
      <View style={styles.actions}>
        <Pill
          label={`${up ? 'Raise' : 'Lower'} to ${suggestion.to} W`}
          variant="light"
          onPress={() => {
            void accept(suggestion.to, suggestion.latestRideId);
            setDone(suggestion.to);
          }}
          testID={`${testID}-accept`}
        />
        <Pressable
          onPress={() => void dismiss(suggestion.latestRideId)}
          accessibilityRole="button"
          style={styles.later}
          testID={`${testID}-dismiss`}
        >
          <Text style={styles.laterText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: ink.surface, borderRadius: radius.card - 2, padding: 18, marginTop: 12, borderWidth: 1, borderColor: ink.emberSoft },
  kicker: { color: ink.emberText, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: ink.text, ...type.headline, marginTop: 6 },
  body: { color: ink.secondary, ...type.callout, marginTop: 6 },
  actions: { marginTop: 14, gap: 4, alignItems: 'stretch' },
  later: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  laterText: { color: ink.secondary, ...type.callout },
});
