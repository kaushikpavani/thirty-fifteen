import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFtpCheck } from '../hooks/useFtpCheck';
import { useHistory } from '../state/HistoryContext';
import { useSettings } from '../state/SettingsContext';
import { useWorkout } from '../state/WorkoutContext';

/**
 * Keeps FTP in step with the rider, continuously: after every ride (from
 * how the last rides went) and on every app open (time off). Only in auto
 * mode, never mid-ride, and every change leaves a notice with Undo.
 * Renders nothing.
 */
export function FtpAutoAdjuster() {
  const { ready } = useSettings();
  const history = useHistory();
  const engine = useWorkout();
  const [now, setNow] = useState(() => Date.now());
  const ftp = useFtpCheck(now);
  const applying = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => sub.remove();
  }, []);

  const riding = engine.state.status === 'running' || engine.state.status === 'paused';

  useEffect(() => {
    if (!ready || !history.ready || riding || !ftp.auto || applying.current) return;
    const s = ftp.suggestion;
    const b = ftp.breakSuggestion;
    if (!s && !b) return;
    applying.current = true;
    const work = s
      ? ftp.applyAuto(s.to, s.reason, { ftpSuggestionDismissed: s.latestRideId })
      : ftp.applyAuto(b!.to, b!.reason, { ftpBreakHandled: b!.rideId });
    void work.finally(() => {
      applying.current = false;
    });
  }, [ready, history.ready, riding, ftp]);

  return null;
}
