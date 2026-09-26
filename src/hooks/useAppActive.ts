import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { isAppInFront } from '../workout/appPresence';

/** True while this app is in front. Leaving it does not pause a running workout. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(() => isAppInFront(AppState.currentState));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setActive(isAppInFront(state));
    });
    return () => sub.remove();
  }, []);

  return active;
}
