import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { hasSeenWelcome, loadSettings, markWelcomeSeen as persistWelcomeSeen, saveSettings } from '../storage/settings';
import { notePendingSettings } from '../storage/settingsCloud';
import { changedKeys } from '../storage/settingsSync';
import type { WorkoutSettings } from '../types';
import { DEFAULT_SETTINGS } from '../workout/defaults';

type SettingsContextValue = {
  ready: boolean;
  settings: WorkoutSettings;
  welcomeSeen: boolean;
  /**
   * Save new settings. Changes are remembered as waiting to be backed up to the rider's
   * account, unless `fromCloud` says they just came from there.
   */
  update: (next: WorkoutSettings, options?: { fromCloud?: boolean }) => Promise<void>;
  markWelcomeSeen: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<WorkoutSettings>(DEFAULT_SETTINGS);
  const [welcomeSeen, setWelcomeSeen] = useState(false);
  /** The settings as last saved, so a change can be told from what it replaced. */
  const current = useRef<WorkoutSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [loaded, seen] = await Promise.all([loadSettings(), hasSeenWelcome()]);
      if (cancelled) return;
      current.current = loaded;
      setSettings(loaded);
      setWelcomeSeen(seen);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (next: WorkoutSettings, options?: { fromCloud?: boolean }) => {
    const changed = options?.fromCloud ? [] : changedKeys(current.current, next);
    current.current = next;
    setSettings(next);
    // Note what changed before saving, so a crash between the two can only cause an extra upload, never a lost one.
    await notePendingSettings(changed);
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
