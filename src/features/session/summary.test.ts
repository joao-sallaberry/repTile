import { bestSet, describeSetCounts, describeSetRecord, finishSummary } from './summary';

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

test('finishSummary counts done and pending sets, and one record per exercise', () => {
  const set = (position: number, completedAt: number | null, isPr = false) => ({ position, completedAt, isPr });
  expect(finishSummary([set(0, 1, true), set(0, 2, true), set(1, 3), set(1, null), set(2, null, true)])).toEqual({
    done: 3,
    total: 5,
    pending: 2,
    prs: 1,
  });
  expect(finishSummary([])).toEqual({ done: 0, total: 0, pending: 0, prs: 0 });
});
