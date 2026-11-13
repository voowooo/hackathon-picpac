import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let mounted = true, changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      changed = true; setReducedMotion(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted && !changed) setReducedMotion(value);
    }).catch(() => {});
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reducedMotion;
}
