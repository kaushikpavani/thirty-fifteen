import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { hasSeenWelcome, loadSettings, markWelcomeSeen as persistWelcomeSeen, saveSettings } from '../storage/settings';
import type { WorkoutSettings } from '../types';
import { DEFAULT_SETTINGS } from '../workout/defaults';

type SettingsContextValue = {
  ready: boolean;
  settings: WorkoutSettings;
  welcomeSeen: boolean;
  update: (next: WorkoutSettings) => Promise<void>;
  markWelcomeSeen: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<WorkoutSettings>(DEFAULT_SETTINGS);
  const [welcomeSeen, setWelcomeSeen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [loaded, seen] = await Promise.all([loadSettings(), hasSeenWelcome()]);
      if (cancelled) return;
      setSettings(loaded);
      setWelcomeSeen(seen);
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

  const markWelcomeSeen = useCallback(async () => {
    setWelcomeSeen(true);
    await persistWelcomeSeen();
  }, []);

  const value = useMemo(
    () => ({ ready, settings, welcomeSeen, update, markWelcomeSeen }),
    [ready, settings, welcomeSeen, update, markWelcomeSeen],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
