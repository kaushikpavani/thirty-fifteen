import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadSettings, saveSettings } from '../storage/settings';
import type { WorkoutSettings } from '../types';
import { DEFAULT_SETTINGS } from '../workout/defaults';

type SettingsContextValue = {
  ready: boolean;
  settings: WorkoutSettings;
  update: (next: WorkoutSettings) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<WorkoutSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadSettings();
      if (cancelled) return;
      setSettings(loaded);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (next: WorkoutSettings) => {
    setSettings(next);
    await saveSettings(next);
  }, []);

  const value = useMemo(() => ({ ready, settings, update }), [ready, settings, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
