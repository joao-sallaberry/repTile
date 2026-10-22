import { useEffect } from 'react';
import { AppState } from 'react-native';

import { playCue } from './beeps';
import { runningMs, timerCues } from './engine';
import { refreshTimerNotifications } from './notifications';
import { useTimerStore } from './store';

/** Skip cues missed by more than this (e.g. the app came back from the background). */
const STALE_MS = 1500;

/**
 * Plays the active timer's beeps while the app is open.
 * In the background scheduled notifications fire and play them (see notifications.ts).
 */
export function useTimerCuePlayer() {
  const active = useTimerStore((s) => s.active);

  useEffect(() => {
    if (!active || active.clock.pausedAt != null) return;
    const cues = timerCues(active.spec, active.clock);
    let lastMs = runningMs(active.clock, Date.now());

    const id = setInterval(() => {
      const nowMs = runningMs(active.clock, Date.now());
      const foreground = AppState.currentState === 'active';
      for (const cue of cues) {
        const at = cue.atSec * 1000;
        if (at > lastMs && at <= nowMs) {
          if (foreground && nowMs - at < STALE_MS) playCue(cue.kind);
          if (cue.kind === 'end') {
            if (active.spec.kind === 'rest') useTimerStore.getState().stop();
            else refreshTimerNotifications();
          }
        }
      }
      lastMs = nowMs;
    }, 100);
    return () => clearInterval(id);
  }, [active]);
}
