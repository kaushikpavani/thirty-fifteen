import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { bleGate, bleGateCopy, type BleGate } from '../ble/availability';
import { BleClientError, createBleClient } from '../ble/client';
import type { FoundDevice } from '../ble/client';
import type { PowerReading } from '../ble/parse';

type Client = Awaited<ReturnType<typeof createBleClient>>;

export type MeterPhase =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'list' }
  | { phase: 'connecting'; name: string }
  | { phase: 'connected'; name: string }
  | { phase: 'blocked'; reason: BleGate | 'unavailable' | 'bluetooth-off' | 'permission' | 'no-devices' | 'no-power'; detail?: string };

type PowerMeterContextValue = {
  phase: MeterPhase;
  devices: FoundDevice[];
  live: { watts: number; speedKph: number | null } | null;
  connect: () => void;
  pick: (device: FoundDevice) => void;
  disconnect: () => Promise<void>;
  dismiss: () => void;
  gateCopy: ReturnType<typeof bleGateCopy> | null;
};

const PowerMeterContext = createContext<PowerMeterContextValue | null>(null);

const FRESH_MS = 4000;

export function PowerMeterProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<Client | null>(null);
  const [phase, setPhase] = useState<MeterPhase>({ phase: 'idle' });
  const [devices, setDevices] = useState<FoundDevice[]>([]);
  const [sample, setSample] = useState<(PowerReading & { updatedAt: number }) | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScanTimer = () => {
    if (scanTimer.current) clearTimeout(scanTimer.current);
    scanTimer.current = null;
  };

  useEffect(() => {
    if (phase.phase !== 'connected') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase.phase]);

  useEffect(() => {
    return () => {
      clearScanTimer();
      void clientRef.current?.disconnect();
      clientRef.current?.destroy();
    };
  }, []);

  const fail = (reason: Extract<MeterPhase, { phase: 'blocked' }>['reason'], detail?: string) => {
    setPhase({ phase: 'blocked', reason, detail });
  };

  const connect = useCallback(() => {
    const gate = bleGate();
    if (gate) {
      setPhase({ phase: 'blocked', reason: gate });
      setDevices([]);
      return;
    }
    setDevices([]);
    setPhase({ phase: 'scanning' });
    void (async () => {
      try {
        if (!clientRef.current) clientRef.current = await createBleClient();
        const client = clientRef.current;
        const found = new Map<string, FoundDevice>();
        await client.scan((device) => {
          found.set(device.id, device);
          setDevices([...found.values()].slice(0, 12));
        });
        clearScanTimer();
        scanTimer.current = setTimeout(() => {
          client.stopScan();
          setPhase((current) => {
            if (current.phase !== 'scanning') return current;
            return found.size ? { phase: 'list' } : { phase: 'blocked', reason: 'no-devices' };
          });
        }, 12000);
      } catch (error) {
        const code = error instanceof BleClientError ? error.message : 'unavailable';
        if (code === 'bluetooth-off' || code === 'permission' || code === 'unavailable') {
          fail(code);
          return;
        }
        fail('unavailable', error instanceof Error ? error.message : undefined);
      }
    })();
  }, []);

  const pick = useCallback((device: FoundDevice) => {
    const client = clientRef.current;
    if (!client) return;
    clearScanTimer();
    setPhase({ phase: 'connecting', name: device.name });
    void (async () => {
      try {
        const name = await client.connect(device.id, (reading) => {
          setSample((prev) => ({
            watts: reading.watts ?? prev?.watts ?? null,
            speedKph: reading.speedKph ?? prev?.speedKph ?? null,
            updatedAt: Date.now(),
          }));
          setNow(Date.now());
        });
        setPhase({ phase: 'connected', name });
      } catch (error) {
        const code = error instanceof BleClientError ? error.message : '';
        if (code === 'no-power') fail('no-power');
        else fail('unavailable', error instanceof Error ? error.message : 'Connection failed.');
      }
    })();
  }, []);

  const disconnect = useCallback(async () => {
    clearScanTimer();
    clientRef.current?.stopScan();
    await clientRef.current?.disconnect();
    setSample(null);
    setDevices([]);
    setPhase({ phase: 'idle' });
  }, []);

  const dismiss = useCallback(() => {
    clearScanTimer();
    clientRef.current?.stopScan();
    setDevices([]);
    setPhase({ phase: 'idle' });
  }, []);

  const live = useMemo(() => {
    if (phase.phase !== 'connected' || !sample || sample.watts == null) return null;
    if (now - sample.updatedAt > FRESH_MS) return null;
    return { watts: sample.watts, speedKph: sample.speedKph };
  }, [phase.phase, sample, now]);

  const gateCopy = phase.phase === 'blocked' ? bleGateCopy(phase.reason) : null;

  const value = useMemo(
    () => ({ phase, devices, live, connect, pick, disconnect, dismiss, gateCopy }),
    [phase, devices, live, connect, pick, disconnect, dismiss, gateCopy],
  );

  return <PowerMeterContext.Provider value={value}>{children}</PowerMeterContext.Provider>;
}

export function usePowerMeter(): PowerMeterContextValue {
  const ctx = useContext(PowerMeterContext);
  if (!ctx) throw new Error('usePowerMeter must be used inside PowerMeterProvider');
  return ctx;
}
