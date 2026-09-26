import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** OS Reduce Motion. Breath and springs drop; color stays. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (live) setReduce(Boolean(value));
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduce(Boolean(value));
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
