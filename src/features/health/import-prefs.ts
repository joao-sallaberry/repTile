import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type HealthImportPrefs = {
  /** Google Health activities (display names, e.g. "CrossFit") imported into the history (ADR 0025). */
  activities: string[];
  setActivities: (activities: string[]) => void;
};

/** Per-device choice of which Google Health activities to import, edited in Ajustes. */
export const useHealthImportPrefs = create<HealthImportPrefs>()(
  persist((set) => ({ activities: [], setActivities: (activities) => set({ activities }) }), {
    name: 'health-import',
    storage: createJSONStorage(() => Storage),
    partialize: (s) => ({ activities: s.activities }),
  }),
);
