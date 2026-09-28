/**
 * Cycling Power is the primary live-watts path (SRAM / Quarq left crank).
 * FTMS stays as a fallback when a trainer does not expose 0x1818.
 * Discovery is by service UUID, not by device name.
 */

export const CPS_SERVICE_UUID = '00001818-0000-1000-8000-00805f9b34fb';
export const FTMS_SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';

/** Scan filter: CPS first, then FTMS. The OS treats the list as a union. */
export const POWER_SCAN_UUIDS = [CPS_SERVICE_UUID, FTMS_SERVICE_UUID] as const;

const CPS_SHORT = '1818';
const FTMS_SHORT = '1826';
const CPS_MEASUREMENT_SHORT = '2a63';
const FTMS_INDOOR_BIKE_SHORT = '2ad2';

export type PowerKind = 'cps' | 'ftms';

export type PowerTarget = {
  kind: PowerKind;
  serviceUUID: string;
  characteristicId: string;
};

export type PowerConnectionState =
  | 'bluetoothUnavailable'
  | 'scanning'
  | 'disconnected'
  | 'connecting'
  | 'connected';

export type RadioBlock = 'bluetooth-off' | 'permission' | 'unavailable';

export function uuidIncludes(uuid: string, shortId: string): boolean {
  return uuid.toLowerCase().replace(/-/g, '').includes(shortId.toLowerCase());
}

export function advertisedServiceUUIDs(device: {
  serviceUUIDs?: string[] | null;
  overflowServiceUUIDs?: string[] | null;
  solicitedServiceUUIDs?: string[] | null;
}): string[] {
  return [
    ...(device.serviceUUIDs ?? []),
    ...(device.overflowServiceUUIDs ?? []),
    ...(device.solicitedServiceUUIDs ?? []),
  ];
}

export function hasPowerService(uuids: string[]): boolean {
  return uuids.some((uuid) => uuidIncludes(uuid, CPS_SHORT) || uuidIncludes(uuid, FTMS_SHORT));
}

/**
 * Filtered scans already asked the radio for 1818 / 1826.
 * An empty advertisement list still counts there, because some stacks omit the UUID
 * after the OS filter matched. An open scan only keeps devices that actually advertise power.
 */
export function shouldReportDevice(
  device: {
    serviceUUIDs?: string[] | null;
    overflowServiceUUIDs?: string[] | null;
    solicitedServiceUUIDs?: string[] | null;
  },
  mode: 'filtered' | 'open',
): boolean {
  const services = advertisedServiceUUIDs(device);
  if (hasPowerService(services)) return true;
  return mode === 'filtered' && services.length === 0;
}

/** CPS before FTMS, even when the peripheral lists FTMS first. */
export function powerTargets(services: { uuid: string }[]): PowerTarget[] {
  const targets: PowerTarget[] = [];
  const cps = services.find((service) => uuidIncludes(service.uuid, CPS_SHORT));
  if (cps) {
    targets.push({
      kind: 'cps',
      serviceUUID: cps.uuid,
      characteristicId: CPS_MEASUREMENT_SHORT,
    });
  }
  const ftms = services.find((service) => uuidIncludes(service.uuid, FTMS_SHORT));
  if (ftms) {
    targets.push({
      kind: 'ftms',
      serviceUUID: ftms.uuid,
      characteristicId: FTMS_INDOOR_BIKE_SHORT,
    });
  }
  return targets;
}

export function characteristicMatches(uuid: string, characteristicId: string): boolean {
  return uuidIncludes(uuid, characteristicId);
}

export function radioBlock(state: string): RadioBlock | null {
  if (state === 'PoweredOn') return null;
  if (state === 'Unauthorized') return 'permission';
  if (state === 'PoweredOff') return 'bluetooth-off';
  return 'unavailable';
}

export function connectionStateFor(phase: { phase: string; reason?: string }): PowerConnectionState {
  switch (phase.phase) {
    case 'scanning':
      return 'scanning';
    case 'connecting':
      return 'connecting';
    case 'connected':
      return 'connected';
    case 'blocked':
      if (phase.reason === 'no-devices' || phase.reason === 'no-power' || phase.reason === 'no-hr') {
        return 'disconnected';
      }
      return 'bluetoothUnavailable';
    default:
      return 'disconnected';
  }
}

export function connectionStateLabel(state: PowerConnectionState): string {
  switch (state) {
    case 'bluetoothUnavailable':
      return 'Bluetooth unavailable';
    case 'scanning':
      return 'Scanning';
    case 'disconnected':
      return 'Disconnected';
    case 'connecting':
      return 'Connecting';
    case 'connected':
      return 'Connected';
  }
}

export function deviceLabel(device: { id: string; name: string | null }): string {
  const name = device.name?.trim();
  if (name) return name;
  const tail = device.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return tail ? `Power meter ${tail}` : 'Power meter';
}

export function powerMeterHint(
  state: PowerConnectionState,
  options?: { liveWatts?: number | null; devices?: number },
): string | null {
  if (state === 'connected' && options?.liveWatts != null) return null;
  if (state === 'connected') return 'Pedal the crank. Watts appear only when the meter sends them.';
  if (state === 'scanning' || state === 'connecting') return 'Pedal the crank to wake the meter.';
  if (state === 'disconnected' && (options?.devices ?? 0) > 0) {
    return 'Tap a meter. Pedal the crank if it is asleep.';
  }
  if (state === 'disconnected') return 'Optional. Watts show up only when a meter sends them.';
  return null;
}
