import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { PowerConnectionState } from '../ble/cps';

export function sensorStatus(state: PowerConnectionState, live: boolean): string {
  if (state === 'connected' && live) return 'Connected · live';
  if (state === 'connected') return 'Connected';
  if (state === 'connecting') return 'Connecting';
  if (state === 'scanning') return 'Scanning';
  if (state === 'bluetoothUnavailable') return 'Unavailable';
  return 'Tap to connect';
}

function Bolt() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="#F2F2F7" />
    </Svg>
  );
}

function Heart() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z"
        fill="#FF375F"
      />
    </Svg>
  );
}

export function SensorChip({
  kind,
  title,
  state,
  live,
  value,
  unit,
  onPress,
  testID,
}: {
  kind: 'power' | 'heart';
  title: string;
  state: PowerConnectionState;
  live: boolean;
  value: string;
  unit: string;
  onPress: () => void;
  testID: string;
}) {
  const status = sensorStatus(state, live);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${status}. ${value} ${unit}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <View style={styles.icon}>{kind === 'power' ? <Bolt /> : <Heart />}</View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.statusRow}>
          <Text style={[styles.status, live && styles.live]}>{status}</Text>
          {live ? <View style={styles.dot} /> : null}
        </View>
      </View>
      <Text style={styles.value}>
        {value} <Text style={styles.unit}>{unit}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: '#16181E',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: { opacity: 0.72 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2D36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  title: { color: '#F5F5F7', fontSize: 16, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { color: '#8E8E93', fontSize: 13, fontWeight: '500' },
  live: { color: '#30D158' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#30D158' },
  value: { color: '#F5F5F7', fontSize: 16, fontWeight: '500', fontVariant: ['tabular-nums'] },
  unit: { color: '#8E8E93', fontWeight: '500' },
});
