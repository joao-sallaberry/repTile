import { useIsFocused } from 'expo-router';
import { Activity, useEffect, useState, type ComponentType } from 'react';

/** How long a screen stays live after losing focus, so it still shows under the next screen's opening animation. */
const FREEZE_DELAY_MS = 700;

/**
 * Wraps a tab screen so it's frozen (`<Activity mode="hidden">`) while another screen is in front of it.
 * Every tab stays mounted behind the session; frozen, its effects are cleaned up, so its live queries
 * stop rerunning and re-rendering on every set completed. They run again when it's shown.
 */
export function freezeWhenBlurred<P extends object>(Screen: ComponentType<P>) {
  function Frozen(props: P) {
    const focused = useIsFocused();
    const [frozen, setFrozen] = useState(false);
    useEffect(() => {
      if (focused) return;
      const id = setTimeout(() => setFrozen(true), FREEZE_DELAY_MS);
      return () => {
        clearTimeout(id);
        setFrozen(false);
      };
    }, [focused]);
    return (
      <Activity mode={frozen && !focused ? 'hidden' : 'visible'}>
        <Screen {...props} />
      </Activity>
    );
  }
  Frozen.displayName = `FreezeWhenBlurred(${Screen.displayName ?? Screen.name})`;
  return Frozen;
}
