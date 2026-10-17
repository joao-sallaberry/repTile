import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { newId } from '@/lib/ids';

import {
  addSeconds as addClockSeconds,
  computeTimer,
  newClock,
  pause as pauseClock,
  resume as resumeClock,
  type TimerClock,
  type TimerSpec,
} from './engine';

export type ActiveTimer = {
  id: string;
  /** Workout session the timer belongs to. */
  sessionId: string | null;
  /** WOD timers: the session block being run. */
  blockId?: string | null;
  /** Text shown in the notification (e.g. "Descanso · Supino reto"). */
  label: string;
  spec: TimerSpec;
  clock: TimerClock;
};

type TimerState = {
  active: ActiveTimer | null;
  start: (input: { sessionId: string | null; blockId?: string | null; label: string; spec: TimerSpec; leadInSec?: number }) => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  addSeconds: (sec: number) => void;
  stop: () => void;
};

/**
 * The active timer (only one at a time: rest or WOD).
 * Persisted in SQLite so it survives the app being killed by the system.
 */
export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      active: null,
      start: ({ sessionId, blockId = null, label, spec, leadInSec = 0 }) =>
        set({ active: { id: newId(), sessionId, blockId, label, spec, clock: newClock(Date.now(), leadInSec) } }),
      pause: () => {
        const a = get().active;
        if (a) set({ active: { ...a, clock: pauseClock(a.clock, Date.now()) } });
      },
      resume: () => {
        const a = get().active;
        if (a) set({ active: { ...a, clock: resumeClock(a.clock, Date.now()) } });
      },
      togglePause: () => (get().active?.clock.pausedAt != null ? get().resume() : get().pause()),
      addSeconds: (sec) => {
        const a = get().active;
        if (a) set({ active: { ...a, clock: addClockSeconds(a.clock, sec) } });
      },
      stop: () => set({ active: null }),
    }),
    {
      name: 'active-timer',
      storage: createJSONStorage(() => Storage),
      partialize: (s) => ({ active: s.active }),
    },
  ),
);

/** Ensures persisted state is loaded (needed in background handlers). */
export async function ensureTimerHydrated() {
  if (!useTimerStore.persist.hasHydrated()) await useTimerStore.persist.rehydrate();
}

export function isTimerFinished(timer: ActiveTimer, now = Date.now()) {
  return computeTimer(timer.spec, timer.clock, now).phase === 'done';
}
