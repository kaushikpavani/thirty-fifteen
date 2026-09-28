import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { bleGate, bleGateCopy } from '../ble/availability';
import { connectionStateLabel } from '../ble/cps';
import { heartRateHint } from '../ble/hrs';
import { PrimaryButton } from './PrimaryButton';
import { useHeartRate } from '../state/HeartRateContext';
import { colors } from '../theme/colors';

/** Heart rate connect sheet. The ride reads beats from context and never invents them. */
export function HeartRatePanel() {
  const heart = useHeartRate();
  const { prepare, releaseHold } = heart;

  useFocusEffect(
    useCallback(() => {
      prepare();
      return () => {
        releaseHold();
      };
    }, [prepare, releaseHold]),
  );

  const staticGate = bleGate();
  const connectionState = staticGate ? 'bluetoothUnavailable' : heart.connectionState;
  const live = staticGate ? null : heart.live;
  const copy = staticGate ? bleGateCopy(staticGate) : heart.gateCopy;
  const hint = copy
    ? null
    : heartRateHint(connectionState, { liveBpm: live?.bpm ?? null, devices: heart.devices.length });
  const busy = connectionState === 'scanning' || connectionState === 'connecting';
  const showDevices = !staticGate && connectionState !== 'connected' && heart.devices.length > 0;
  const name = heart.phase.phase === 'connected' || heart.phase.phase === 'connecting' ? heart.phase.name : null;

  return (
    <View style={styles.body} testID="settings-heart-rate">
      <Text style={styles.state} testID={`heart-rate-state-${connectionState}`}>
        {connectionStateLabel(connectionState)}
        {name ? ` · ${name}` : ''}
      </Text>
      {copy ? (
        <View testID="heart-rate-gate">
          <Text style={styles.gateTitle}>{copy.title}</Text>
          <Text style={styles.hint}>{copy.body}</Text>
        </View>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {live ? (
        <Text style={styles.live} testID="heart-rate-bpm" accessibilityLabel={`${live.bpm} beats per minute`}>
          {live.bpm} bpm
        </Text>
      ) : null}
      {showDevices
        ? heart.devices.map((device) => (
            <Pressable
              key={device.id}
              onPress={() => heart.pick(device)}
              disabled={busy}
              testID="heart-rate-device"
              style={styles.device}
            >
              <Text style={styles.deviceName}>{device.name}</Text>
            </Pressable>
          ))
        : null}
      {staticGate ? null : heart.phase.phase === 'connected' ? (
        <PrimaryButton variant="quiet" label="Disconnect" onPress={() => void heart.disconnect()} testID="heart-rate-disconnect" />
      ) : (
        <PrimaryButton
          variant="hairline"
          label={connectionState === 'scanning' ? 'Scanning…' : connectionState === 'connecting' ? 'Connecting…' : 'Scan'}
          onPress={heart.connect}
          disabled={busy}
          testID="heart-rate-scan"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 10, paddingHorizontal: 20 },
  state: { color: colors.text, fontSize: 16, fontWeight: '500' },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  gateTitle: { color: colors.text, fontSize: 16 },
  live: { color: colors.text, fontSize: 28, fontWeight: '300', fontVariant: ['tabular-nums'] },
  device: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  deviceName: { color: colors.text, fontSize: 16 },
});
