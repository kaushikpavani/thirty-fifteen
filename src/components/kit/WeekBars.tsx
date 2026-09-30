import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ink, type } from '../../theme/tokens';
import type { Week } from '../../logic/trends';

function weekLabel(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Minutes in HARD per week. One column per week with 4px rounded tops and a
 * 2px gap; empty weeks keep their slot so gaps in training are visible.
 * Tap a week for its numbers.
 */
export function WeekBars({ weeks, color, height = 120 }: { weeks: Week[]; color: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.hardMinutes));
  const shown = active != null ? weeks[active] : weeks[weeks.length - 1];
  return (
    <View>
      <Text style={styles.readout}>
        {shown
          ? `Week of ${weekLabel(shown.start)} · ${shown.rides} ${shown.rides === 1 ? 'ride' : 'rides'} · ${Math.round(shown.hardMinutes)} min in HARD · ${Math.round(shown.workKj)} kJ`
          : ' '}
      </Text>
      <View style={[styles.row, { height }]}>
        {weeks.map((w, i) => {
          const h = w.hardMinutes > 0 ? Math.max(4, (w.hardMinutes / max) * height) : 2;
          return (
            <Pressable
              key={w.start}
              style={styles.slot}
              onPress={() => setActive(i === active ? null : i)}
              accessibilityRole="button"
              accessibilityLabel={`Week of ${weekLabel(w.start)}: ${Math.round(w.hardMinutes)} minutes in HARD, ${w.rides} rides`}
              testID={`week-${i}`}
            >
              <View
                style={{
                  height: h,
                  backgroundColor: w.hardMinutes > 0 ? color : ink.raised,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  opacity: active == null || active === i ? 1 : 0.45,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{weeks.length ? weekLabel(weeks[0]!.start) : ''}</Text>
        <Text style={styles.axisText}>This week</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { color: ink.secondary, ...type.caption, ...type.tabular, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  slot: { flex: 1, justifyContent: 'flex-end', height: '100%' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { color: ink.tertiary, fontSize: 11 },
});
