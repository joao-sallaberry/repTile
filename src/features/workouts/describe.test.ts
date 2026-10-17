import { describeTargets } from './describe';

test('describeTargets summarizes warm-ups and varying working sets', () => {
  expect(
    describeTargets([
      { type: 'warmup', reps: 12, weight: 40 },
      { type: 'warmup', reps: 6, weight: 60 },
      { type: 'normal', reps: 8, weight: 82.5 },
      { type: 'normal', reps: 8, weight: 80 },
      { type: 'normal', reps: 10, weight: 75 },
    ]),
  ).toBe('2 aquec. + 3 séries · 75–82,5 kg × 8–10');
  expect(describeTargets([{ type: 'normal', reps: 10, weight: null }])).toBe('1 série · 10 reps');
});
