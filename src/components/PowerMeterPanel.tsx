import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { bleGate, bleGateCopy } from '../ble/availability';
import { connectionStateLabel, powerMeterHint } from '../ble/cps';
import { PrimaryButton } from './PrimaryButton';
import { usePowerMeter } from '../state/PowerMeterContext';
import { colors } from '../theme/colors';

/**
 * Shared power-meter controls. Settings shows them before Start.
 * The finish screen uses the same body after the ride.
 * The running countdown never mounts this.
 */
export function PowerMeterPanel({ variant }: { variant: 'settings' | 'finish' }) {
  const meter = usePowerMeter();
  const [open, setOpen] = useState(variant === 'settings');
  const { prepare, releaseHold } = meter;

  useFocusEffect(
    useCallback(() => {
      if (variant !== 'settings') return;
      prepare();
      return () => {
        releaseHold();
      };
    }, [prepare, releaseHold, variant]),
  );

  const staticGate = bleGate();
  if (variant === 'finish' && staticGate) return null;

  const connectionState = staticGate ? 'bluetoothUnavailable' : meter.connectionState;
  const live = staticGate ? null : meter.live;
  const copy = staticGate ? bleGateCopy(staticGate) : meter.gateCopy;
  const hint = copy
    ? null
    : powerMeterHint(connectionState, { liveWatts: live?.watts ?? null, devices: meter.devices.length });
  const busy = connectionState === 'scanning' || connectionState === 'connecting';
  const showDevices = !staticGate && connectionState !== 'connected' && meter.devices.length > 0;
  const name =
    meter.phase.phase === 'connected' || meter.phase.phase === 'connecting' ? meter.phase.name : null;

  const body = (
    <View style={styles.body}>
      <Text style={styles.state} testID={`power-meter-state-${connectionState}`}>
        {connectionStateLabel(connectionState)}
        {name ? ` · ${name}` : ''}
      </Text>
      {copy ? (
        <View testID="power-meter-gate">
          <Text style={styles.gateTitle}>{copy.title}</Text>
          <Text style={styles.hint}>{copy.body}</Text>
        </View>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {live ? (
        <Text
          style={styles.live}
          testID={variant === 'finish' ? 'finish-live-watts' : 'power-meter-watts'}
          accessibilityLabel={`${live.watts} watts`}
        >
          {live.watts} W{live.speedKph != null ? ` · ${live.speedKph.toFixed(1)} km/h` : ''}
        </Text>
      ) : null}
      {showDevices
        ? meter.devices.map((device) => (
            <Pressable
              key={device.id}
              onPress={() => meter.pick(device)}
              disabled={busy}
              testID="power-meter-device"
              style={styles.device}
            >
              <Text style={styles.deviceName}>{device.name}</Text>
            </Pressable>
          ))
        : null}
      {staticGate ? null : meter.phase.phase === 'connected' ? (
        <PrimaryButton
          variant="quiet"
          label="Disconnect"
          onPress={() => void meter.disconnect()}
          testID={variant === 'finish' ? 'finish-disconnect' : 'power-meter-disconnect'}
        />
      ) : (
        <PrimaryButton
          variant="hairline"
          label={connectionState === 'scanning' ? 'Scanning…' : connectionState === 'connecting' ? 'Connecting…' : 'Scan'}
          onPress={meter.connect}
          disabled={busy}
          testID={variant === 'finish' ? 'finish-scan' : 'power-meter-scan'}
        />
      )}
    </View>
  );

  if (variant === 'finish') {
    return (
      <View style={styles.wrap}>
        <Pressable onPress={() => setOpen((value) => !value)} testID="finish-power" accessibilityRole="button">
          <Text style={styles.link}>{open ? 'Hide power meter' : live ? `Power meter · ${live.watts} W` : 'Power meter'}</Text>
        </Pressable>
        {open ? body : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="settings-power-meter">
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  body: { gap: 10 },
  link: { color: colors.textDim, fontSize: 15 },
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
