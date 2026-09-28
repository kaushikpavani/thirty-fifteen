import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { bleGate, bleGateCopy, type BleGate } from '../ble/availability';
import { bleLog } from '../ble/log';
import { HrClientError, createHrClient, type FoundHeartRate } from '../ble/hrClient';
import { connectionStateFor, type PowerConnectionState } from '../ble/cps';
import { clearSavedHeartRate, loadSavedHeartRate, saveHeartRate, type SavedHeartRate } from '../storage/heartRate';

type Client = Awaited<ReturnType<typeof createHrClient>>;

export type HeartPhase =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'list' }
  | { phase: 'connecting'; name: string }
  | { phase: 'connected'; name: string }
  | {
      phase: 'blocked';
      reason: BleGate | 'unavailable' | 'bluetooth-off' | 'permission' | 'no-devices' | 'no-hr';
      detail?: string;
    };

type HeartRateContextValue = {
  phase: HeartPhase;
  connectionState: PowerConnectionState;
  devices: FoundHeartRate[];
  live: { bpm: number } | null;
  connect: () => void;
  pick: (device: FoundHeartRate) => void;
  disconnect: () => Promise<void>;
  forget: () => Promise<void>;
  prepare: () => void;
  releaseHold: () => void;
  dismiss: () => void;
  gateCopy: ReturnType<typeof bleGateCopy> | null;
};

const HeartRateContext = createContext<HeartRateContextValue | null>(null);

const FRESH_MS = 4000;
const SCAN_MS = 12000;

export function HeartRateProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<Client | null>(null);
  const phaseRef = useRef<HeartPhase>({ phase: 'idle' });
  const savedRef = useRef<SavedHeartRate | null>(null);
  const loadedRef = useRef<Promise<SavedHeartRate | null> | null>(null);
  const userHeldRef = useRef(false);
  const scanOnFailRef = useRef(false);
  const fallbackLockRef = useRef(false);
  const lostRetryAtRef = useRef(0);
  const opRef = useRef(0);
  const scanGen = useRef(0);
  const mountedRef = useRef(true);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectDeviceRef = useRef<(id: string, name: string, known: boolean) => Promise<void>>(async () => {});
  const beginScanRef = useRef<(autoConnectSaved: boolean) => Promise<void>>(async () => {});

  const [phase, setPhase] = useState<HeartPhase>({ phase: 'idle' });
  const [devices, setDevices] = useState<FoundHeartRate[]>([]);
  const [sample, setSample] = useState<{ bpm: number; updatedAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const clearScanTimer = () => {
    if (scanTimer.current) clearTimeout(scanTimer.current);
    scanTimer.current = null;
  };

  const setHeartPhase = useCallback((next: HeartPhase) => {
    phaseRef.current = next;
    if (!mountedRef.current) return;
    setPhase(next);
    bleLog('hr-state', connectionStateFor(next));
  }, []);

  const applyFailure = useCallback(
    (error: unknown) => {
      const code = error instanceof HrClientError ? error.message : '';
      if (code === 'bluetooth-off' || code === 'permission' || code === 'unavailable' || code === 'no-hr') {
        setHeartPhase({ phase: 'blocked', reason: code });
        return;
      }
      setHeartPhase({
        phase: 'blocked',
        reason: 'unavailable',
        detail: error instanceof Error ? error.message : undefined,
      });
    },
    [setHeartPhase],
  );

  const handleSample = useCallback((bpm: number) => {
    if (!mountedRef.current) return;
    const current = phaseRef.current.phase;
    if (current !== 'connected' && current !== 'connecting') return;
    setSample({ bpm, updatedAt: Date.now() });
    setNow(Date.now());
  }, []);

  const handleLost = useCallback(() => {
    if (userHeldRef.current) return;
    if (phaseRef.current.phase !== 'connected' && phaseRef.current.phase !== 'connecting') return;
    setSample(null);
    const saved = savedRef.current;
    const stamp = Date.now();
    if (!saved || stamp - lostRetryAtRef.current < 15000) {
      setHeartPhase({ phase: 'idle' });
      return;
    }
    lostRetryAtRef.current = stamp;
    void connectDeviceRef.current(saved.id, saved.name, true);
  }, [setHeartPhase]);

  const ensureClient = useCallback(async () => {
    if (!clientRef.current) clientRef.current = await createHrClient();
    return clientRef.current;
  }, []);

  const connectDevice = useCallback(
    async (id: string, name: string, known: boolean) => {
      const op = ++opRef.current;
      scanGen.current += 1;
      clearScanTimer();
      clientRef.current?.stopScan();
      setHeartPhase({ phase: 'connecting', name });
      try {
        await clientRef.current?.disconnect();
        if (op !== opRef.current) return;
        const client = await ensureClient();
        if (op !== opRef.current) return;
        const linked = known
          ? await client.connectKnown(id, handleSample, handleLost)
          : await client.connect(id, handleSample, handleLost);
        if (op !== opRef.current) return;
        const saved = { id, name: linked || name };
        savedRef.current = saved;
        userHeldRef.current = false;
        await saveHeartRate(saved);
        bleLog('hr-saved', saved.id);
        if (op !== opRef.current) return;
        setHeartPhase({ phase: 'connected', name: saved.name });
      } catch (error) {
        if (op !== opRef.current) return;
        const code = error instanceof HrClientError ? error.message : '';
        if (
          known &&
          code === 'not-found' &&
          scanOnFailRef.current &&
          !fallbackLockRef.current &&
          !userHeldRef.current
        ) {
          fallbackLockRef.current = true;
          bleLog('hr-reconnect-failed', id);
          await beginScanRef.current(true);
          return;
        }
        if (known && code === 'not-found') {
          bleLog('hr-reconnect-failed', id);
          setHeartPhase({ phase: 'idle' });
          return;
        }
        applyFailure(error);
      }
    },
    [applyFailure, ensureClient, handleLost, handleSample, setHeartPhase],
  );

  const beginScan = useCallback(
    async (autoConnectSaved: boolean) => {
      const gate = bleGate();
      if (gate) {
        setDevices([]);
        setHeartPhase({ phase: 'blocked', reason: gate });
        return;
      }
      const gen = ++scanGen.current;
      if (mountedRef.current) setDevices([]);
      setHeartPhase({ phase: 'scanning' });
      try {
        const client = await ensureClient();
        if (gen !== scanGen.current) return;
        const found = new Map<string, FoundHeartRate>();
        await client.scan((device) => {
          if (gen !== scanGen.current || !mountedRef.current) return;
          found.set(device.id, device);
          setDevices([...found.values()].slice(0, 12));
          const savedId = savedRef.current?.id;
          if (autoConnectSaved && savedId && device.id === savedId && !userHeldRef.current) {
            scanGen.current += 1;
            clearScanTimer();
            void connectDeviceRef.current(device.id, device.name, false);
          }
        });
        if (gen !== scanGen.current) return;
        clearScanTimer();
        scanTimer.current = setTimeout(() => {
          if (gen !== scanGen.current) return;
          client.stopScan();
          if (phaseRef.current.phase !== 'scanning') return;
          setHeartPhase(found.size ? { phase: 'list' } : { phase: 'blocked', reason: 'no-devices' });
        }, SCAN_MS);
      } catch (error) {
        if (gen !== scanGen.current) return;
        applyFailure(error);
      }
    },
    [applyFailure, ensureClient, setHeartPhase],
  );

  // Scan and connect callbacks call each other through refs; keep them current after each commit.
  useLayoutEffect(() => {
    connectDeviceRef.current = connectDevice;
    beginScanRef.current = beginScan;
  });

  useEffect(() => {
    const pending = loadSavedHeartRate();
    loadedRef.current = pending;
    let cancelled = false;
    void (async () => {
      const saved = await pending;
      if (cancelled || !mountedRef.current) return;
      savedRef.current = saved;
      bleLog('hr-saved', saved?.id ?? 'none');
      if (!saved || bleGate() || userHeldRef.current) return;
      if (phaseRef.current.phase !== 'idle') return;
      await connectDeviceRef.current(saved.id, saved.name, true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase.phase !== 'connected') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase.phase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      opRef.current += 1;
      clearScanTimer();
      void clientRef.current?.disconnect();
      clientRef.current?.destroy();
      clientRef.current = null;
    };
  }, []);

  const connect = useCallback(() => {
    userHeldRef.current = false;
    scanOnFailRef.current = false;
    fallbackLockRef.current = false;
    opRef.current += 1;
    clearScanTimer();
    void (async () => {
      await clientRef.current?.disconnect();
      if (!mountedRef.current) return;
      await beginScanRef.current(false);
    })();
  }, []);

  const pick = useCallback((device: FoundHeartRate) => {
    userHeldRef.current = false;
    scanOnFailRef.current = false;
    void connectDeviceRef.current(device.id, device.name, false);
  }, []);

  const disconnect = useCallback(async () => {
    opRef.current += 1;
    userHeldRef.current = true;
    scanOnFailRef.current = false;
    clearScanTimer();
    clientRef.current?.stopScan();
    await clientRef.current?.disconnect();
    setSample(null);
    setDevices([]);
    setHeartPhase({ phase: 'idle' });
  }, [setHeartPhase]);

  const forget = useCallback(async () => {
    opRef.current += 1;
    userHeldRef.current = true;
    scanOnFailRef.current = false;
    savedRef.current = null;
    clearScanTimer();
    clientRef.current?.stopScan();
    await clientRef.current?.disconnect();
    await clearSavedHeartRate();
    setSample(null);
    setDevices([]);
    setHeartPhase({ phase: 'idle' });
  }, [setHeartPhase]);

  const releaseHold = useCallback(() => {
    userHeldRef.current = false;
  }, []);

  const prepare = useCallback(() => {
    const gate = bleGate();
    if (gate) {
      setHeartPhase({ phase: 'blocked', reason: gate });
      return;
    }
    scanOnFailRef.current = true;
    void (async () => {
      if (loadedRef.current) {
        const saved = await loadedRef.current;
        if (!savedRef.current && saved) savedRef.current = saved;
      }
      const current = phaseRef.current.phase;
      if (current === 'connected' || current === 'scanning' || current === 'connecting' || current === 'list') return;
      if (userHeldRef.current) return;
      fallbackLockRef.current = false;
      const saved = savedRef.current;
      if (!saved) return;
      await connectDeviceRef.current(saved.id, saved.name, true);
    })();
  }, [setHeartPhase]);

  const dismiss = useCallback(() => {
    scanGen.current += 1;
    clearScanTimer();
    clientRef.current?.stopScan();
    setDevices([]);
    if (phaseRef.current.phase === 'connected') return;
    setHeartPhase({ phase: 'idle' });
  }, [setHeartPhase]);

  const live = useMemo(() => {
    if (phase.phase !== 'connected' || !sample) return null;
    if (now - sample.updatedAt > FRESH_MS) return null;
    return { bpm: sample.bpm };
  }, [phase.phase, sample, now]);

  const connectionState = connectionStateFor(phase);
  const gateCopy = phase.phase === 'blocked' ? bleGateCopy(phase.reason) : null;

  const value = useMemo(
    () => ({
      phase,
      connectionState,
      devices,
      live,
      connect,
      pick,
      disconnect,
      forget,
      prepare,
      releaseHold,
      dismiss,
      gateCopy,
    }),
    [phase, connectionState, devices, live, connect, pick, disconnect, forget, prepare, releaseHold, dismiss, gateCopy],
  );

  return <HeartRateContext.Provider value={value}>{children}</HeartRateContext.Provider>;
}

export function useHeartRate(): HeartRateContextValue {
  const ctx = useContext(HeartRateContext);
  if (!ctx) throw new Error('useHeartRate must be used inside HeartRateProvider');
  return ctx;
}
