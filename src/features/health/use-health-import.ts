import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useHealthImportPrefs } from './import-prefs';
import { importHealthWorkouts } from './repo';

/** Health Connect reads cost a few hundred ms: coming back to the app re-imports at most this often. */
const MIN_INTERVAL_MS = 5 * 60_000;

/**
 * Keeps the history in step with Google Health (ADR 0025): imports the picked activities when the app opens,
 * when it comes back to the foreground (Health Connect only reads in the foreground) and when the picks change.
 */
export function useHealthImport(enabled: boolean) {
  const activities = useHealthImportPrefs((s) => s.activities);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android' || activities.length === 0) return;
    let last = 0;
    const run = () => {
      if (Date.now() - last < MIN_INTERVAL_MS) return;
      last = Date.now();
      importHealthWorkouts(activities).catch(() => {});
    };
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, [enabled, activities]);
}
