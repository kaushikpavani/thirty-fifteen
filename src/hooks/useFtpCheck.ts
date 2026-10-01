import { useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { breakAdjustment, ftpSuggestion, startingFtp, type BreakAdjustment, type FtpSuggestion } from '../logic/ftpAdapt';
import { estimateMaxHr, observedMaxBpmFromHistory } from '../logic/vo2max';
import { useHistory } from '../state/HistoryContext';
import { useSettings } from '../state/SettingsContext';
import { syncProfile } from '../storage/cloud';
import type { WorkoutSettings } from '../types';

/**
 * The rides-based FTP check, shared by the auto-adjuster, the finish
 * screen, Home and Settings. It re-evaluates after every ride and every
 * app open, for as long as the rider rides — the "last 3 rides" is a
 * moving window, not a limit.
 */
/** Pass `now` (held in state by the caller) to evaluate time off; without it, breaks aren't checked. */
export function useFtpCheck(now?: number) {
  const { settings, update } = useSettings();
  const history = useHistory();
  const auth = useAuth();

  /** A raise or lower from recent rides that hasn't been applied or waved off. */
  const suggestion: FtpSuggestion | null = useMemo(() => {
    const maxHr = observedMaxBpmFromHistory(history.sessions) ?? (settings.ageYears ? estimateMaxHr(settings.ageYears) : null);
    const s = ftpSuggestion(history.sessions, settings.ftpWatts, maxHr);
    return s && s.latestRideId !== settings.ftpSuggestionDismissed ? s : null;
  }, [history.sessions, settings.ftpWatts, settings.ageYears, settings.ftpSuggestionDismissed]);

  const lastRide = history.sessions[0] ?? null;

  /** Time off since the last ride, once per break, and only for an FTP that came from the rider or their rides. */
  const breakSuggestion: (BreakAdjustment & { rideId: string }) | null = useMemo(() => {
    if (now == null || !settings.ftpSetByRider || !lastRide || settings.ftpBreakHandled === lastRide.id) return null;
    const b = breakAdjustment(lastRide.endedAt, now, settings.ftpWatts);
    return b ? { ...b, rideId: lastRide.id } : null;
  }, [settings.ftpSetByRider, settings.ftpBreakHandled, settings.ftpWatts, lastRide, now]);

  /** A weight-based first FTP, offered only while FTP is still the placeholder. */
  const starting = useMemo(() => {
    if (settings.ftpSetByRider) return null;
    const guess = startingFtp(settings.weightLb, settings.sex);
    return guess != null && guess !== settings.ftpWatts ? guess : null;
  }, [settings.ftpSetByRider, settings.weightLb, settings.sex, settings.ftpWatts]);

  const save = useCallback(
    async (patch: Partial<WorkoutSettings>) => {
      const ftpChanged = patch.ftpWatts != null && patch.ftpWatts !== settings.ftpWatts;
      await update({ ...settings, ...patch });
      if (ftpChanged && auth.user) void syncProfile(auth.user);
    },
    [settings, update, auth.user],
  );

  /** Rider tapped to accept a suggestion or the starting guess. */
  const accept = useCallback(
    (watts: number, basedOnRideId?: string) =>
      save({
        ftpWatts: watts,
        ftpSetByRider: true,
        ftpSuggestionDismissed: basedOnRideId ?? settings.ftpSuggestionDismissed ?? null,
        ftpChange: null,
      }),
    [save, settings.ftpSuggestionDismissed],
  );

  const dismiss = useCallback((rideId: string) => save({ ftpSuggestionDismissed: rideId }), [save]);

  const acceptBreak = useCallback(
    (b: BreakAdjustment & { rideId: string }) => save({ ftpWatts: b.to, ftpBreakHandled: b.rideId, ftpChange: null }),
    [save],
  );
  const dismissBreak = useCallback((rideId: string) => save({ ftpBreakHandled: rideId }), [save]);

  /** Auto mode: apply a change now and leave a notice the rider can undo. */
  const applyAuto = useCallback(
    (to: number, reason: string, marks: Partial<WorkoutSettings>) =>
      save({
        ...marks,
        ftpWatts: to,
        ftpSetByRider: true,
        ftpChange: { from: settings.ftpWatts, to, reason, at: new Date().toISOString() },
      }),
    [save, settings.ftpWatts],
  );

  /** Put FTP back. The marks stay, so the same rides don't re-apply it. */
  const undoChange = useCallback(() => {
    const c = settings.ftpChange;
    if (c) void save({ ftpWatts: c.from, ftpChange: null });
  }, [save, settings.ftpChange]);

  const ackChange = useCallback(() => void save({ ftpChange: null }), [save]);

  return {
    auto: settings.ftpAuto !== false,
    suggestion,
    breakSuggestion,
    starting,
    change: settings.ftpChange ?? null,
    accept,
    dismiss,
    acceptBreak,
    dismissBreak,
    applyAuto,
    undoChange,
    ackChange,
  };
}
