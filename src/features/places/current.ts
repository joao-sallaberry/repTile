import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** The location new workouts start at (a per-device preference, not synced). */
export const useCurrentLocation = create<{ id: string | null; set: (id: string | null) => void }>()(
  persist((set) => ({ id: null, set: (id) => set({ id }) }), {
    name: 'current-location',
    storage: createJSONStorage(() => Storage),
    partialize: (s) => ({ id: s.id }),
  }),
);
