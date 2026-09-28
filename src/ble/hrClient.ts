import { PermissionsAndroid, Platform } from 'react-native';
import { acquireBleManager, releaseBleManager } from './manager';
import { bleLog } from './log';
import { base64ToBytes, bytesToHex, parseHeartRate } from './parse';
import {
  HR_SCAN_UUIDS,
  characteristicMatches,
  heartRateLabel,
  heartRateTarget,
  shouldReportHeartRate,
} from './hrs';
import { radioBlock } from './cps';

export type FoundHeartRate = {
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
const MONITOR_ID = 'hrs-measurement';

export class HrClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HrClientError';
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
      throw new HrClientError('permission');
    }
    return;
  }
  const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  if (fine !== PermissionsAndroid.RESULTS.GRANTED) throw new HrClientError('permission');
}

function asHrError(error: unknown): HrClientError {
  if (error instanceof HrClientError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/powered off|bluetooth.*off/i.test(message)) return new HrClientError('bluetooth-off');
  if (/unauthorized|permission|denied/i.test(message)) return new HrClientError('permission');
  return new HrClientError('not-found');
}

export async function createHrClient(): Promise<{
  scan: (onDevice: (device: FoundHeartRate) => void) => Promise<void>;
  stopScan: () => void;
  connect: (id: string, onBpm: (bpm: number) => void, onLost: () => void) => Promise<string>;
  connectKnown: (id: string, onBpm: (bpm: number) => void, onLost: () => void) => Promise<string>;
  disconnect: () => Promise<void>;
  destroy: () => void;
}> {
  await ensureAndroidPermission();
  let manager: ManagerLike;
  try {
    manager = await acquireBleManager<ManagerLike>();
  } catch {
    throw new HrClientError('unavailable');
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
      bleLog('hr-state', state);
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
    const block = radioBlock(radio);
    if (block) throw new HrClientError(block);
  }

  async function safeCancel(device: DeviceLike): Promise<void> {
    try {
      await device.cancelConnection();
    } catch {
      // already gone
    }
  }

  async function listen(linked: DeviceLike, onBpm: (bpm: number) => void, onLost: () => void): Promise<string> {
    const token = epoch;
    active = linked;
    clearMonitor();
    const ready = await linked.discoverAllServicesAndCharacteristics();
    if (token !== epoch) throw new HrClientError('not-found');
    active = ready;
    const services = await ready.services();
    const target = heartRateTarget(services);
    if (token !== epoch) throw new HrClientError('not-found');
    if (!target) {
      await safeCancel(ready);
      active = null;
      throw new HrClientError('no-hr');
    }
    const chars = await ready.characteristicsForService(target.serviceUUID);
    const characteristic = chars.find((item) => characteristicMatches(item.uuid, target.characteristicId));
    if (!characteristic) {
      await safeCancel(ready);
      active = null;
      throw new HrClientError('no-hr');
    }
    if (typeof ready.onDisconnected === 'function') {
      dropSub = ready.onDisconnected(() => {
        if (token !== epoch) return;
        clearMonitor();
        active = null;
        onLost();
      });
    }
    monitor = ready.monitorCharacteristicForService(
      target.serviceUUID,
      characteristic.uuid,
      (error, update) => {
        if (error || !update?.value) return;
        try {
          const bytes = base64ToBytes(update.value);
          bleLog('hr-rx', bytesToHex(bytes));
          const bpm = parseHeartRate(bytes);
          if (bpm == null) return;
          onBpm(bpm);
        } catch {
          bleLog('hr-rx-drop', 'malformed');
        }
      },
      MONITOR_ID,
      'notification',
    );
    return ready.name?.trim() || heartRateLabel(ready);
  }

  async function connectKnownId(id: string, onBpm: (bpm: number) => void, onLost: () => void): Promise<string> {
    await requireRadio();
    stopScan();
    const cached = seen.get(id);
    if (cached) {
      const linked = await cached.connect(CONNECT_OPTIONS);
      return listen(linked, onBpm, onLost);
    }
    if (typeof manager.devices === 'function') {
      try {
        const known = await manager.devices([id]);
        const found = known.find((item) => item.id === id) ?? known[0];
        if (found) {
          seen.set(found.id, found);
          const linked = await found.connect(CONNECT_OPTIONS);
          return listen(linked, onBpm, onLost);
        }
      } catch (error) {
        bleLog('hr-retrieve-failed', error instanceof Error ? error.message : 'error');
      }
    }
    if (typeof manager.connectToDevice !== 'function') throw new HrClientError('not-found');
    const linked = await manager.connectToDevice(id, CONNECT_OPTIONS);
    seen.set(linked.id, linked);
    return listen(linked, onBpm, onLost);
  }

  return {
    scan: async (onDevice) => {
      await requireRadio();
      seen.clear();
      scanMode = 'filtered';
      const listener = (error: unknown, device: DeviceLike | null) => {
        if (error || !device || !shouldReportHeartRate(device, scanMode)) return;
        seen.set(device.id, device);
        onDevice({
          id: device.id,
          name: heartRateLabel(device),
          rssi: device.rssi,
        });
      };
      try {
        await manager.startDeviceScan([...HR_SCAN_UUIDS], { allowDuplicates: false }, listener);
        bleLog('hr-scan', 'withServices 180d');
      } catch (error) {
        bleLog('hr-scan-fallback', error instanceof Error ? error.message : 'open');
        scanMode = 'open';
        await manager.startDeviceScan(null, { allowDuplicates: false }, listener);
      }
    },
    stopScan,
    connect: async (id, onBpm, onLost) => {
      try {
        await requireRadio();
        stopScan();
        const cached = seen.get(id);
        if (!cached) throw new HrClientError('not-found');
        const linked = await cached.connect(CONNECT_OPTIONS);
        return await listen(linked, onBpm, onLost);
      } catch (error) {
        throw asHrError(error);
      }
    },
    connectKnown: async (id, onBpm, onLost) => {
      try {
        return await connectKnownId(id, onBpm, onLost);
      } catch (error) {
        throw asHrError(error);
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
