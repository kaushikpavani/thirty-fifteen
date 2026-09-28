import { PermissionsAndroid, Platform } from 'react-native';
import {
  POWER_SCAN_UUIDS,
  characteristicMatches,
  deviceLabel,
  powerTargets,
  radioBlock,
  shouldReportDevice,
  type PowerKind,
} from './cps';
import { bleLog } from './log';
import { acquireBleManager, releaseBleManager } from './manager';
import { base64ToBytes, bytesToHex, parseCyclingPower, parseIndoorBikeData, type PowerReading } from './parse';

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
  overflowServiceUUIDs?: string[] | null;
  solicitedServiceUUIDs?: string[] | null;
  connect: (options?: { timeout?: number; refreshGatt?: 'OnConnected' }) => Promise<DeviceLike>;
  discoverAllServicesAndCharacteristics: () => Promise<DeviceLike>;
  services: () => Promise<{ uuid: string }[]>;
  characteristicsForService: (uuid: string) => Promise<{ uuid: string }[]>;
  monitorCharacteristicForService: (
    serviceUUID: string,
    characteristicUUID: string,
    listener: (error: unknown, characteristic: { value: string | null } | null) => void,
    transactionId?: string,
    subscriptionType?: 'notification' | 'indication',
  ) => { remove: () => void };
  onDisconnected?: (listener: (error: unknown) => void) => { remove: () => void };
  cancelConnection: () => Promise<unknown>;
};

type ManagerLike = {
  state: () => Promise<string>;
  onStateChange?: (listener: (state: string) => void, emitCurrent?: boolean) => { remove: () => void };
  startDeviceScan: (
    uuids: string[] | null,
    options: { allowDuplicates: boolean } | null,
    listener: (error: unknown, device: DeviceLike | null) => void,
  ) => Promise<void> | void;
  stopDeviceScan: () => Promise<void> | void;
  devices?: (ids: string[]) => Promise<DeviceLike[]>;
  connectToDevice?: (id: string, options?: { timeout?: number; refreshGatt?: 'OnConnected' }) => Promise<DeviceLike>;
  destroy: () => void;
};

const CONNECT_OPTIONS = { timeout: 15000, refreshGatt: 'OnConnected' as const };
const MONITOR_ID = 'cps-measurement';

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

function asBleError(error: unknown): BleClientError {
  if (error instanceof BleClientError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/powered off|bluetooth.*off/i.test(message)) return new BleClientError('bluetooth-off');
  if (/unauthorized|permission|denied/i.test(message)) return new BleClientError('permission');
  if (/not found|unknown device|no such|cancelled|timed out|timeout/i.test(message)) {
    return new BleClientError('not-found');
  }
  return new BleClientError('not-found');
}

export async function createBleClient(): Promise<{
  scan: (onDevice: (device: FoundDevice) => void) => Promise<void>;
  stopScan: () => void;
  connect: (id: string, onSample: (reading: PowerReading) => void, onLost: () => void) => Promise<string>;
  connectKnown: (id: string, onSample: (reading: PowerReading) => void, onLost: () => void) => Promise<string>;
  disconnect: () => Promise<void>;
  destroy: () => void;
}> {
  await ensureAndroidPermission();
  let manager: ManagerLike;
  try {
    manager = await acquireBleManager<ManagerLike>();
  } catch {
    throw new BleClientError('unavailable');
  }

  let monitor: { remove: () => void } | null = null;
  let dropSub: { remove: () => void } | null = null;
  let stateSub: { remove: () => void } | null = null;
  let active: DeviceLike | null = null;
  let epoch = 0;
  let released = false;
  let scanMode: 'filtered' | 'open' = 'filtered';
  const seen = new Map<string, DeviceLike>();

  if (typeof manager.onStateChange === 'function') {
    stateSub = manager.onStateChange((state) => {
      bleLog('state', state);
    }, true);
  }

  const stopScan = () => {
    try {
      void manager.stopDeviceScan();
    } catch {
      // scan may already be stopped
    }
  };

  const clearMonitor = () => {
    monitor?.remove();
    monitor = null;
    dropSub?.remove();
    dropSub = null;
  };

  async function requireRadio(): Promise<void> {
    const radio = await manager.state();
    bleLog('state', radio);
    const block = radioBlock(radio);
    if (block) throw new BleClientError(block);
  }

  function currentEpoch(): number {
    return epoch;
  }

  function superseded(token: number): boolean {
    return token !== epoch;
  }

  async function listen(
    linked: DeviceLike,
    onSample: (reading: PowerReading) => void,
    onLost: () => void,
  ): Promise<string> {
    const token = currentEpoch();
    active = linked;
    clearMonitor();
    bleLog('connected', { id: linked.id, name: linked.name });
    const ready = await linked.discoverAllServicesAndCharacteristics();
    if (superseded(token)) throw new BleClientError('not-found');
    active = ready;
    const services = await ready.services();
    bleLog(
      'services',
      services.map((service) => service.uuid),
    );
    const targets = powerTargets(services);
    let chosen: { serviceUUID: string; characteristicUUID: string; kind: PowerKind } | null = null;
    for (const target of targets) {
      const chars = await ready.characteristicsForService(target.serviceUUID);
      bleLog(
        'characteristics',
        chars.map((item) => item.uuid),
      );
      const characteristic = chars.find((item) => characteristicMatches(item.uuid, target.characteristicId));
      if (!characteristic) continue;
      chosen = {
        serviceUUID: target.serviceUUID,
        characteristicUUID: characteristic.uuid,
        kind: target.kind,
      };
      break;
    }
    if (superseded(token)) throw new BleClientError('not-found');
    if (!chosen) {
      await safeCancel(ready);
      active = null;
      throw new BleClientError('no-power');
    }
    bleLog('notify', { kind: chosen.kind, service: chosen.serviceUUID, characteristic: chosen.characteristicUUID });
    if (typeof ready.onDisconnected === 'function') {
      dropSub = ready.onDisconnected((error) => {
        if (superseded(token)) return;
        bleLog('disconnected', error instanceof Error ? error.message : 'link-lost');
        clearMonitor();
        active = null;
        onLost();
      });
    }
    const kind = chosen.kind;
    monitor = ready.monitorCharacteristicForService(
      chosen.serviceUUID,
      chosen.characteristicUUID,
      (error, update) => {
        if (error || !update?.value) {
          if (error) bleLog('notify-error', error instanceof Error ? error.message : 'error');
          return;
        }
        try {
          const bytes = base64ToBytes(update.value);
          bleLog('rx', bytesToHex(bytes));
          const reading = kind === 'cps' ? parseCyclingPower(bytes) : parseIndoorBikeData(bytes);
          if (!reading) {
            bleLog('rx-drop', 'short-or-empty');
            return;
          }
          if (reading.watts != null) bleLog('watts', reading.watts);
          onSample(reading);
        } catch {
          bleLog('rx-drop', 'malformed');
        }
      },
      MONITOR_ID,
      'notification',
    );
    return ready.name?.trim() || deviceLabel(ready);
  }

  async function safeCancel(device: DeviceLike): Promise<void> {
    try {
      await device.cancelConnection();
    } catch {
      // already gone
    }
  }

  async function connectCached(
    id: string,
    onSample: (reading: PowerReading) => void,
    onLost: () => void,
  ): Promise<string> {
    await requireRadio();
    stopScan();
    const cached = seen.get(id);
    if (!cached) throw new BleClientError('not-found');
    bleLog('connect', { id, via: 'scan-cache' });
    const linked = await cached.connect(CONNECT_OPTIONS);
    return listen(linked, onSample, onLost);
  }

  async function connectKnownId(
    id: string,
    onSample: (reading: PowerReading) => void,
    onLost: () => void,
  ): Promise<string> {
    await requireRadio();
    stopScan();
    const cached = seen.get(id);
    if (cached) return connectCached(id, onSample, onLost);
    if (typeof manager.devices === 'function') {
      try {
        const known = await manager.devices([id]);
        const found = known.find((item) => item.id === id) ?? known[0];
        if (found) {
          seen.set(found.id, found);
          bleLog('connect', { id, via: 'retrieve' });
          const linked = await found.connect(CONNECT_OPTIONS);
          return listen(linked, onSample, onLost);
        }
      } catch (error) {
        bleLog('retrieve-failed', error instanceof Error ? error.message : 'error');
      }
    }
    if (typeof manager.connectToDevice !== 'function') throw new BleClientError('not-found');
    bleLog('connect', { id, via: 'connectToDevice' });
    const linked = await manager.connectToDevice(id, CONNECT_OPTIONS);
    seen.set(linked.id, linked);
    return listen(linked, onSample, onLost);
  }

  return {
    scan: async (onDevice) => {
      await requireRadio();
      seen.clear();
      scanMode = 'filtered';
      const listener = (error: unknown, device: DeviceLike | null) => {
        if (error) {
          bleLog('scan-error', error instanceof Error ? error.message : 'error');
          return;
        }
        if (!device || !shouldReportDevice(device, scanMode)) return;
        seen.set(device.id, device);
        const found = {
          id: device.id,
          name: deviceLabel(device),
          rssi: device.rssi,
        };
        bleLog('discovered', {
          id: found.id,
          name: found.name,
          rssi: found.rssi,
          services: device.serviceUUIDs,
        });
        onDevice(found);
      };
      try {
        await manager.startDeviceScan([...POWER_SCAN_UUIDS], { allowDuplicates: false }, listener);
        bleLog('scan', 'withServices 1818,1826');
      } catch (error) {
        bleLog('scan-fallback', error instanceof Error ? error.message : 'open');
        scanMode = 'open';
        await manager.startDeviceScan(null, { allowDuplicates: false }, listener);
      }
    },
    stopScan,
    connect: async (id, onSample, onLost) => {
      try {
        return await connectCached(id, onSample, onLost);
      } catch (error) {
        throw asBleError(error);
      }
    },
    connectKnown: async (id, onSample, onLost) => {
      try {
        return await connectKnownId(id, onSample, onLost);
      } catch (error) {
        throw asBleError(error);
      }
    },
    disconnect: async () => {
      epoch += 1;
      clearMonitor();
      const device = active;
      active = null;
      if (!device) return;
      await safeCancel(device);
    },
    destroy: () => {
      if (released) return;
      released = true;
      epoch += 1;
      clearMonitor();
      active = null;
      stateSub?.remove();
      stateSub = null;
      releaseBleManager();
    },
  };
}
