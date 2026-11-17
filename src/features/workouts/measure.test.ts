import { defaultAmounts } from './measure';

test('defaultAmounts sets only the unit of the measure', () => {
  expect(defaultAmounts('reps')).toEqual({ reps: 10, durationSec: null, distanceM: null, calories: null });
  expect(defaultAmounts('weight_reps').reps).toBe(10);
  expect(defaultAmounts(undefined).reps).toBe(10);
  expect(defaultAmounts('calories')).toEqual({ reps: null, durationSec: null, distanceM: null, calories: 10 });
  expect(defaultAmounts('distance')).toEqual({ reps: null, durationSec: null, distanceM: 200, calories: null });
  expect(defaultAmounts('time')).toEqual({ reps: null, durationSec: 60, distanceM: null, calories: null });
});
