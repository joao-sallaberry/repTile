import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SetType } from '@/db/schema';

type SessionPreferences = {
  /** Completing a warm-up set starts the rest timer (like any other set). */
  restAfterWarmup: boolean;
  setRestAfterWarmup: (value: boolean) => void;
};

/** Per-device workout preferences, edited in Ajustes. */
export const useSessionPreferences = create<SessionPreferences>()(
  persist(
    (set) => ({ restAfterWarmup: true, setRestAfterWarmup: (restAfterWarmup) => set({ restAfterWarmup }) }),
    {
      name: 'session-preferences',
      storage: createJSONStorage(() => Storage),
      partialize: (s) => ({ restAfterWarmup: s.restAfterWarmup }),
    },
  ),
);

/** Whether completing a set of this type starts its rest timer. */
export function startsRest(type: SetType, prefs: Pick<SessionPreferences, 'restAfterWarmup'>): boolean {
  return type !== 'warmup' || prefs.restAfterWarmup;
}
