import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** True while this app is in front. Leaving it does not pause a running workout. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  return active;
}
