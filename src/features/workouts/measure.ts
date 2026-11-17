import type { Measure } from '@/db/schema';

export type Amounts = {
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
  calories: number | null;
};

/**
 * Starting target of a new item or movement, in the exercise's own unit: 10 reps, 1 min, 200 m or 10 cal.
 * Only that unit is set, so "Remo (cal)" doesn't start as "10 reps".
 */
export function defaultAmounts(measure: Measure | undefined): Amounts {
  const none: Amounts = { reps: null, durationSec: null, distanceM: null, calories: null };
  switch (measure) {
    case 'time':
      return { ...none, durationSec: 60 };
    case 'distance':
      return { ...none, distanceM: 200 };
    case 'calories':
      return { ...none, calories: 10 };
    default:
      return { ...none, reps: 10 };
  }
}
