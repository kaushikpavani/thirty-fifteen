import { PermissionsAndroid, Platform } from 'react-native';
import {
  base64ToBytes,
  parseCyclingPower,
  parseIndoorBikeData,
  type PowerReading,
} from './parse';

const INDOOR_BIKE = '2ad2';
const CYCLING_POWER = '2a63';
const FTMS = '1826';
const CPS = '1818';

export type FoundDevice = {
  id: string;
  name: string;
  rssi: number | null;
};

type DeviceLike = {
  id: string;
  name: string | null;
  rssi: number | null;
  serviceUUIDs: string[] | null;
  connect: (options?: { timeout?: number }) => Promise<DeviceLike>;
  discoverAllServicesAndCharacteristics: () => Promise<DeviceLike>;
  services: () => Promise<{ uuid: string }[]>;
  characteristicsForService: (uuid: string) => Promise<{ uuid: string }[]>;
  monitorCharacteristicForService: (
    serviceUUID: string,
    characteristicUUID: string,
    listener: (error: unknown, characteristic: { value: string | null } | null) => void,
  ) => { remove: () => void };
  cancelConnection: () => Promise<unknown>;
};

type ManagerLike = {
  state: () => Promise<string>;
  startDeviceScan: (
    uuids: string[] | null,
    options: { allowDuplicates: boolean } | null,
    listener: (error: unknown, device: DeviceLike | null) => void,
  ) => Promise<void> | void;
  stopDeviceScan: () => Promise<void> | void;
  destroy: () => void;
};

export class BleClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BleClientError';
  }
}

async function ensureAndroidPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  if (api >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    const scan = result['android.permission.BLUETOOTH_SCAN'];
    const connect = result['android.permission.BLUETOOTH_CONNECT'];
    if (scan !== PermissionsAndroid.RESULTS.GRANTED || connect !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new BleClientError('permission');
    }
    return;
  }
  const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new BleClientError('permission');
  }
}

function isInteresting(device: DeviceLike): boolean {
  const services = (device.serviceUUIDs ?? []).map((item) => item.toLowerCase());
  const hasPower = services.some((item) => item.includes(FTMS) || item.includes(CPS));
  if (hasPower) return true;
  return Boolean(device.name?.trim());
}

export async function createBleClient(): Promise<{
  scan: (onDevice: (device: FoundDevice) => void) => Promise<void>;
  stopScan: () => void;
  connect: (id: string, onSample: (reading: PowerReading) => void) => Promise<string>;
  disconnect: () => Promise<void>;
  destroy: () => void;
}> {
  await ensureAndroidPermission();
  let manager: ManagerLike;
  try {
    const ble = (await import('react-native-ble-plx')) as {
      BleManager: new () => ManagerLike;
    };
    manager = new ble.BleManager();
  } catch {
    throw new BleClientError('unavailable');
  }

  let monitor: { remove: () => void } | null = null;
  let connected: DeviceLike | null = null;
  const seen = new Map<string, DeviceLike>();

  const stopScan = () => {
    try {
      void manager.stopDeviceScan();
    } catch {
      // scan may already be stopped
    }
  };

  return {
    scan: async (onDevice) => {
      const radio = await manager.state();
      if (radio !== 'PoweredOn') throw new BleClientError('bluetooth-off');
      seen.clear();
      await manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error || !device || !isInteresting(device)) return;
        seen.set(device.id, device);
        onDevice({
          id: device.id,
          name: device.name?.trim() || 'Unnamed trainer',
          rssi: device.rssi,
        });
      });
    },
    stopScan,
    connect: async (id, onSample) => {
      stopScan();
      const cached = seen.get(id);
      if (!cached) throw new BleClientError('unavailable');
      const linked = await cached.connect({ timeout: 12000 });
      const ready = await linked.discoverAllServicesAndCharacteristics();
      connected = ready;
      const services = await ready.services();
      const ftms = services.find((service) => service.uuid.toLowerCase().includes(FTMS));
      const cps = services.find((service) => service.uuid.toLowerCase().includes(CPS));
      const service = ftms ?? cps;
      if (!service) {
        await ready.cancelConnection();
        connected = null;
        throw new BleClientError('no-power');
      }
      const usingFtms = Boolean(ftms);
      const chars = await ready.characteristicsForService(service.uuid);
      const needle = usingFtms ? INDOOR_BIKE : CYCLING_POWER;
      const characteristic = chars.find((item) => item.uuid.toLowerCase().includes(needle));
      if (!characteristic) {
        await ready.cancelConnection();
        connected = null;
        throw new BleClientError('no-power');
      }
      monitor = ready.monitorCharacteristicForService(
        service.uuid,
        characteristic.uuid,
        (error, update) => {
          if (error || !update?.value) return;
          try {
            const bytes = base64ToBytes(update.value);
            const reading = usingFtms ? parseIndoorBikeData(bytes) : parseCyclingPower(bytes);
            if (!reading) return;
            onSample(reading);
          } catch {
            // ignore a bad packet
          }
        },
      );
      return ready.name?.trim() || 'Power meter';
    },
    disconnect: async () => {
      monitor?.remove();
      monitor = null;
      if (connected) {
        try {
          await connected.cancelConnection();
        } catch {
          // already gone
        }
        connected = null;
      }
    },
    destroy: () => {
      monitor?.remove();
      monitor = null;
      try {
        manager.destroy();
      } catch {
        // ignore
      }
    },
  };
}
