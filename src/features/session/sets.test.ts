import { countsTowardStats, pairPrevious, setLabels } from './sets';

test('setLabels numbers only normal sets', () => {
  expect(setLabels(['warmup', 'warmup', 'normal', 'normal', 'drop', 'normal', 'failure'])).toEqual([
    'W', 'W', '1', '2', 'D', '3', 'F',
  ]);
});

test('pairPrevious matches by type and order', () => {
  const prev = [
    { type: 'warmup' as const, weight: 40 },
    { type: 'normal' as const, weight: 80 },
    { type: 'normal' as const, weight: 82.5 },
  ];
  const paired = pairPrevious(
    [{ type: 'warmup' }, { type: 'warmup' }, { type: 'normal' }, { type: 'normal' }, { type: 'normal' }],
    prev,
  );
  expect(paired.map((p) => p?.weight ?? null)).toEqual([40, null, 80, 82.5, null]);
});

test('warm-ups do not count towards stats', () => {
  expect(countsTowardStats('warmup')).toBe(false);
  expect(countsTowardStats('drop')).toBe(true);
});
