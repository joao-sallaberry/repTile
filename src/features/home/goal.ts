import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Weekly training goal (number of sessions), a per-device preference. `null` = no goal. */
export const useWeeklyGoal = create<{ goal: number | null; set: (goal: number | null) => void }>()(
  persist((set) => ({ goal: null, set: (goal) => set({ goal }) }), {
    name: 'weekly-goal',
    storage: createJSONStorage(() => Storage),
    partialize: (s) => ({ goal: s.goal }),
  }),
);
