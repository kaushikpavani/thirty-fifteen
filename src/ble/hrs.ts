/**
 * Heart Rate Service for a watch that broadcasts HR (Garmin Fenix Broadcast HR).
 * Discovery is by 0x180D, then Heart Rate Measurement 0x2A37. Not by device name.
 */

export const HRS_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
export const HRS_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

export const HR_SCAN_UUIDS = [HRS_SERVICE_UUID] as const;

const HRS_SHORT = '180d';
const HRS_MEASUREMENT_SHORT = '2a37';

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

export function hasHeartRateService(uuids: string[]): boolean {
  return uuids.some((uuid) => uuidIncludes(uuid, HRS_SHORT));
}

/**
 * A filtered scan already asked for 180D. An empty advertisement still counts,
 * because some stacks omit the UUID after the filter matches.
 */
export function shouldReportHeartRate(
  device: {
    serviceUUIDs?: string[] | null;
    overflowServiceUUIDs?: string[] | null;
    solicitedServiceUUIDs?: string[] | null;
  },
  mode: 'filtered' | 'open',
): boolean {
  const services = advertisedServiceUUIDs(device);
  if (hasHeartRateService(services)) return true;
  return mode === 'filtered' && services.length === 0;
}

export function heartRateTarget(services: { uuid: string }[]): { serviceUUID: string; characteristicId: string } | null {
  const service = services.find((item) => uuidIncludes(item.uuid, HRS_SHORT));
  if (!service) return null;
  return { serviceUUID: service.uuid, characteristicId: HRS_MEASUREMENT_SHORT };
}

export function characteristicMatches(uuid: string, characteristicId: string): boolean {
  return uuidIncludes(uuid, characteristicId);
}

export function heartRateLabel(device: { id: string; name: string | null }): string {
  const name = device.name?.trim();
  if (name) return name;
  const tail = device.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return tail ? `Heart rate ${tail}` : 'Heart rate';
}

export function heartRateHint(
  state: 'bluetoothUnavailable' | 'scanning' | 'disconnected' | 'connecting' | 'connected',
  options?: { liveBpm?: number | null; devices?: number },
): string | null {
  if (state === 'connected' && options?.liveBpm != null) return null;
  if (state === 'connected') return 'Heart rate appears only when the watch sends a beat.';
  if (state === 'scanning' || state === 'connecting') return 'Wake the watch so it is broadcasting heart rate.';
  if (state === 'disconnected' && (options?.devices ?? 0) > 0) return 'Tap a watch. Broadcast HR has to be on.';
  if (state === 'disconnected') return 'Optional. Beats show up only when a watch sends them.';
  return null;
}
