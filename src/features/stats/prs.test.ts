import { compareWodResults, computePRs, estimateOneRepMax, isNewPR, type PerformedSet } from './prs';

const set = (sessionId: string, weight: number, reps: number, at = 0): PerformedSet => ({
  sessionId, weight, reps, completedAt: at,
});

test('estimateOneRepMax (Epley)', () => {
  expect(estimateOneRepMax(100, 1)).toBe(100);
  expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.33, 1);
  expect(estimateOneRepMax(0, 10)).toBe(0);
});

test('computePRs', () => {
  const prs = computePRs([
    set('a', 80, 10, 1),
    set('a', 90, 5, 2),
    set('b', 100, 2, 3),
    set('b', 100, 3, 4),
    set('b', 20, 0, 5), // a set without reps is ignored
  ]);
  expect(prs.maxWeight).toEqual({ value: 100, reps: 3, at: 4 });
  expect(prs.bestOneRepMax?.value).toBeCloseTo(110);
  expect(prs.maxReps).toEqual({ value: 10, at: 1 });
  expect(prs.bestSessionVolume).toEqual({ value: 1250, sessionId: 'a', at: 2 });
});

test('isNewPR', () => {
  const history = [set('a', 100, 5)];
  expect(isNewPR(history, set('b', 105, 1))).toBe(true);
  expect(isNewPR(history, set('b', 100, 6))).toBe(true);
  expect(isNewPR(history, set('b', 95, 5))).toBe(false);
  expect(isNewPR([], set('b', 50, 5))).toBe(false); // the first time doesn't count as a PR
});

test('compareWodResults', () => {
  const t = (s: number) => ({ resultTimeSec: s, resultRounds: null, resultReps: null });
  const r = (rounds: number, reps: number) => ({ resultTimeSec: null, resultRounds: rounds, resultReps: reps });
  expect(compareWodResults('for_time', t(300), t(400))).toBeGreaterThan(0);
  expect(compareWodResults('for_time', t(900), r(5, 0))).toBeGreaterThan(0);
  expect(compareWodResults('amrap', r(10, 5), r(10, 3))).toBeGreaterThan(0);
  expect(compareWodResults('amrap', r(9, 30), r(10, 0))).toBeLessThan(0);
});
