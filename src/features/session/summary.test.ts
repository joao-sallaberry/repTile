import { bestSet, describeSetCounts, describeSetRecord } from './summary';

// summary.ts also loads records from the database; these tests only cover its pure helpers (jest hoists the mock).
jest.mock('@/db/client', () => ({ db: {} }));

test('describeSetCounts', () => {
  expect(describeSetCounts(['warmup', 'warmup', 'normal', 'normal', 'normal'])).toBe('2 W + 3 séries');
  expect(describeSetCounts(['normal', 'drop'])).toBe('1 série + 1 D');
  expect(describeSetCounts(['normal', 'failure'])).toBe('1 série + 1 F');
  expect(describeSetCounts([])).toBe('');
});

test('bestSet: heaviest, then most reps', () => {
  expect(
    bestSet([
      { weight: 80, reps: 8 },
      { weight: 82.5, reps: 6 },
      { weight: 82.5, reps: 8 },
    ]),
  ).toEqual({ weight: 82.5, reps: 8 });
  expect(bestSet([])).toBeUndefined();
});

test('describeSetRecord: heavier load, else estimated 1RM', () => {
  expect(describeSetRecord({ weight: 82.5, reps: 8 }, [{ weight: 80, reps: 8 }])).toEqual({
    what: 'maior carga',
    detail: '82,5 kg × 8 · antes 80 kg × 8',
  });
  const orm = describeSetRecord({ weight: 70, reps: 8 }, [{ weight: 70, reps: 6 }]);
  expect(orm.what).toBe('1RM estimado');
  expect(orm.detail).toMatch(/^88,7 kg \(70 kg × 8\) · antes 84 kg$/);
  expect(describeSetRecord({ weight: 50, reps: 5 }, [])).toEqual({ what: 'maior carga', detail: '50 kg × 5' });
});
