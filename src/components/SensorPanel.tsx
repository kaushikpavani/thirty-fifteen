import React, { useCallback, useEffect } from 'react';
import { Animated, Easing, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { useFocusEffect } from 'expo-router';
import { bleGate, bleGateCopy } from '../ble/availability';
import type { PowerConnectionState } from '../ble/cps';
import { ink } from '../theme/tokens';
import { Footer, Group, IconTile, Row, SectionHeader } from './kit/Grouped';
import { Icon } from './kit/Icon';
import { tapHaptic } from './kit/Pill';

type Device = { id: string; name: string; rssi: number | null };

export type SensorApi = {
  phase: { phase: string; name?: string };
  connectionState: PowerConnectionState;
  devices: Device[];
  connect: () => void;
  pick: (device: Device) => void;
  disconnect: () => Promise<void>;
  prepare: () => void;
  releaseHold: () => void;
  gateCopy: ReturnType<typeof bleGateCopy> | null;
};

export function Spinner({ color = ink.secondary, size = 14 }: { color?: string; size?: number }) {
  const spin = useAnimatedValue(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Icon name="spinner" size={size} color={color} />
    </Animated.View>
  );
}

export function signalBars(rssi: number | null): number {
  if (rssi == null) return 2;
  if (rssi >= -60) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -80) return 2;
  return 1;
}

function Signal({ rssi }: { rssi: number | null }) {
  const on = signalBars(rssi);
  return (
    <View style={styles.signal} accessibilityElementsHidden>
      {[5, 8, 11, 14].map((h, i) => (
        <View key={h} style={{ width: 3, height: h, borderRadius: 1, backgroundColor: i < on ? ink.text : '#48484A' }} />
      ))}
    </View>
  );
}

function signalWord(rssi: number | null): string {
  const bars = signalBars(rssi);
  return bars >= 4 ? 'strong signal' : bars === 3 ? 'good signal' : bars === 2 ? 'fair signal' : 'weak signal';
}

/**
 * Power and heart-rate connect screen. iOS list cells: every nearby device is a
 * full-width row, tappable the moment it appears, even mid-scan. The scan
 * indicator lives in the section header and never covers the list.
 */
export function SensorPanel({
  kind,
  api,
  live,
  testPrefix,
}: {
  kind: 'power' | 'heart';
  api: SensorApi;
  live: string | null;
  testPrefix: string;
}) {
  const { prepare, releaseHold } = api;
  useFocusEffect(
    useCallback(() => {
      prepare();
      return () => releaseHold();
    }, [prepare, releaseHold]),
  );

  const staticGate = bleGate();
  const state: PowerConnectionState = staticGate ? 'bluetoothUnavailable' : api.connectionState;
  const gate = staticGate ? bleGateCopy(staticGate) : api.gateCopy;
  const connectedName = api.phase.phase === 'connected' ? api.phase.name ?? null : null;
  const connectingName = api.phase.phase === 'connecting' ? api.phase.name ?? null : null;
  const accent = kind === 'power' ? ink.ember : ink.rose;
  const icon = kind === 'power' ? 'bolt' : 'heart';
  const noun = kind === 'power' ? 'meter' : 'watch';
  const scanning = state === 'scanning';
  const devices = staticGate ? [] : api.devices;

  const status =
    state === 'connected'
      ? { title: connectedName ?? 'Connected', detail: live ?? (kind === 'power' ? 'Pedal to see watts.' : 'Waiting for a beat.') }
      : state === 'connecting'
        ? { title: `Connecting${connectingName ? ` to ${connectingName}` : ''}…`, detail: kind === 'power' ? 'Keep pedaling.' : 'Keep the watch awake.' }
        : state === 'bluetoothUnavailable'
          ? { title: 'Bluetooth unavailable', detail: gate?.body ?? 'Turn on Bluetooth to connect.' }
          : { title: 'Not connected', detail: kind === 'power' ? 'Turn the cranks to wake your meter.' : 'Turn on Broadcast Heart Rate on your watch.' };

  return (
    <View testID={`${testPrefix}-panel`}>
      <SectionHeader>Status</SectionHeader>
      <Group inset={68}>
        <Row
          label={status.title}
          detail={status.detail}
          testID={`${testPrefix}-state-${state}`}
          leading={<IconTile name={icon} bg={state === 'connected' ? accent : '#2C2C2E'} fg={state === 'connected' ? (kind === 'power' ? '#000' : '#fff') : '#8E8E93'} size={40} />}
          trailing={state === 'connecting' ? <Spinner color={ink.emberText} /> : undefined}
        />
        {state === 'connected' ? (
          <Row
            label="Disconnect"
            tint={ink.danger}
            chevron={false}
            onPress={() => void api.disconnect()}
            testID={`${testPrefix}-disconnect`}
          />
        ) : null}
      </Group>
      {gate && state !== 'bluetoothUnavailable' ? <Footer>{gate.body}</Footer> : null}
      {gate && /permission|settings/i.test(`${gate.title} ${gate.body}`) ? (
        <Group style={{ marginTop: 12 }}>
          <Row label="Open Settings" tint={ink.emberText} chevron={false} onPress={() => void Linking.openSettings()} />
        </Group>
      ) : null}

      {state !== 'connected' && state !== 'bluetoothUnavailable' ? (
        <>
          <SectionHeader
            trailing={
              scanning ? (
                <View style={styles.searching} accessibilityLabel="Searching">
                  <Spinner />
                  <Text style={styles.searchingText}>Searching</Text>
                </View>
              ) : undefined
            }
          >
            Nearby
          </SectionHeader>
          {devices.length > 0 ? (
            <Group inset={62}>
              {devices.map((device) => {
                const connectingThis = connectingName != null && connectingName === device.name;
                return (
                  <Row
                    key={device.id}
                    label={device.name}
                    detail={connectingThis ? 'Connecting…' : `${kind === 'power' ? 'Power' : 'Heart rate'} · ${signalWord(device.rssi)}`}
                    highlighted={connectingThis}
                    onPress={() => {
                      tapHaptic('light');
                      api.pick(device);
                    }}
                    disabled={connectingThis}
                    chevron={!connectingThis}
                    testID={`${testPrefix}-device`}
                    accessibilityLabel={`${device.name}, ${connectingThis ? 'connecting' : signalWord(device.rssi)}. Double tap to connect.`}
                    leading={<IconTile name={icon} bg={connectingThis ? accent : '#3A3A3C'} fg={connectingThis && kind === 'power' ? '#000' : '#F5F5F2'} size={34} />}
                    trailing={connectingThis ? <Spinner color={ink.emberText} size={18} /> : <Signal rssi={device.rssi} />}
                  />
                );
              })}
            </Group>
          ) : (
            <Group>
              <Row
                label={scanning ? `Looking for your ${noun}…` : 'No devices yet'}
                detail={kind === 'power' ? 'Pedal to wake your meter, then search.' : 'Enable Broadcast HR, then search.'}
              />
            </Group>
          )}
          <Footer>Tap any {noun} to connect, even while searching. 30/15 remembers it and reconnects on its own.</Footer>
          <Group style={{ marginTop: 20 }}>
            <Row
              label={scanning ? 'Searching…' : 'Search again'}
              tint={scanning ? ink.secondary : ink.emberText}
              chevron={false}
              onPress={api.connect}
              disabled={scanning}
              testID={`${testPrefix}-scan`}
            />
          </Group>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  signal: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  searching: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchingText: { color: '#8E8E93', fontSize: 13 },
});
