import { useEffect, useState } from 'react';

import { computeTimer, type TimerSnapshot } from './engine';
import type { ActiveTimer } from './store';

/** Recomputes the timer state several times per second for the UI. */
export function useTimerSnapshot(timer: ActiveTimer | null): TimerSnapshot | null {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [timer]);
  return timer ? computeTimer(timer.spec, timer.clock, now) : null;
}
