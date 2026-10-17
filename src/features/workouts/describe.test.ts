import { describeResult, describeRounds, describeTargets } from './describe';

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

test('describeResult', () => {
  const base = { resultTimeSec: null, resultRounds: null, resultReps: null, rx: true };
  expect(describeResult({ ...base, kind: 'for_time', resultTimeSec: 402 })).toBe('6:42 · Rx');
  expect(describeResult({ ...base, kind: 'amrap', resultRounds: 12, resultReps: 5, rx: false })).toBe('12 rounds + 5 reps · Scaled');
  expect(describeResult({ ...base, kind: 'tabata', resultReps: 40, roundReps: [14, 11, 15] })).toBe('40 reps · pior round 11 · Rx');
  expect(describeResult({ ...base, kind: 'tabata' })).toBeNull();
});

test('describeRounds', () => {
  expect(describeRounds({ kind: 'for_time', roundSplits: [231, 402], roundReps: null })).toBe('Parciais 3:51 · 2:51');
  expect(describeRounds({ kind: 'tabata', roundSplits: null, roundReps: [14, 11] })).toBe('Por round 14 · 11');
  expect(describeRounds({ kind: 'emom', roundSplits: null, roundReps: null })).toBeNull();
});
