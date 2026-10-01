import { useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ftpSuggestion, startingFtp, type FtpSuggestion } from '../logic/ftpAdapt';
import { estimateMaxHr, observedMaxBpmFromHistory } from '../logic/vo2max';
import { useHistory } from '../state/HistoryContext';
import { useSettings } from '../state/SettingsContext';
import { syncProfile } from '../storage/cloud';

/**
 * The rides-based FTP check, shared by the finish screen and Settings.
 * Suggestions are never applied without the rider tapping to accept.
 */
export function useFtpCheck(): {
  /** A raise or lower the rider hasn't waved off. */
  suggestion: FtpSuggestion | null;
  /** A weight-based first FTP, offered only while FTP is still the placeholder. */
  starting: number | null;
  accept: (watts: number, basedOnRideId?: string) => Promise<void>;
  dismiss: (rideId: string) => Promise<void>;
} {
  const { settings, update } = useSettings();
  const history = useHistory();
  const auth = useAuth();

  const suggestion = useMemo(() => {
    const maxHr = observedMaxBpmFromHistory(history.sessions) ?? (settings.ageYears ? estimateMaxHr(settings.ageYears) : null);
    const s = ftpSuggestion(history.sessions, settings.ftpWatts, maxHr);
    return s && s.latestRideId !== settings.ftpSuggestionDismissed ? s : null;
  }, [history.sessions, settings.ftpWatts, settings.ageYears, settings.ftpSuggestionDismissed]);

  const starting = useMemo(() => {
    if (settings.ftpSetByRider) return null;
    const guess = startingFtp(settings.weightLb, settings.sex);
    return guess != null && guess !== settings.ftpWatts ? guess : null;
  }, [settings.ftpSetByRider, settings.weightLb, settings.sex, settings.ftpWatts]);

  const accept = useCallback(
    async (watts: number, basedOnRideId?: string) => {
      await update({
        ...settings,
        ftpWatts: watts,
        ftpSetByRider: true,
        ftpSuggestionDismissed: basedOnRideId ?? settings.ftpSuggestionDismissed ?? null,
      });
      if (auth.user) void syncProfile(auth.user);
    },
    [settings, update, auth.user],
  );

  const dismiss = useCallback(
    async (rideId: string) => {
      await update({ ...settings, ftpSuggestionDismissed: rideId });
    },
    [settings, update],
  );

  return { suggestion, starting, accept, dismiss };
}
