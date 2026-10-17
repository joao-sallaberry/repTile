import {
  defaultBlockConfig,
  describeBlockFormat,
  describeShape,
  emomMovementIndex,
  splitDurations,
  tabataMovementIndex,
  workoutIcon,
  worstRound,
} from './blocks';

const emom = { ...defaultBlockConfig('emom'), rounds: 12 };

test('describeBlockFormat', () => {
  expect(describeBlockFormat(defaultBlockConfig('exercises'))).toBeNull();
  expect(describeBlockFormat({ ...defaultBlockConfig('amrap'), durationSec: 1200 })).toBe('AMRAP 20 min');
  expect(describeBlockFormat(emom)).toBe('EMOM 12 min');
  expect(describeBlockFormat({ ...emom, alternate: true })).toBe('EMOM 12 min · alternado');
  expect(describeBlockFormat({ ...emom, intervalSec: 90, rounds: 8 })).toBe('EMOM 8 × 1:30');
  expect(describeBlockFormat(defaultBlockConfig('for_time'))).toBe('3 rounds for time · cap 15:00');
  expect(describeBlockFormat(defaultBlockConfig('tabata'))).toBe('Tabata 8 × 20s/10s');
  expect(describeBlockFormat({ ...defaultBlockConfig('tabata'), workSec: 90, rounds: 4 })).toBe('Tabata 4 × 1:30/10s');
});

test('tabataMovementIndex cycles every round', () => {
  expect([1, 2, 3, 4].map((r) => tabataMovementIndex(r, 2))).toEqual([0, 1, 0, 1]);
  expect(tabataMovementIndex(1, 0)).toBeNull();
});

test('splitDurations and worstRound', () => {
  expect(splitDurations([231, 402, 590])).toEqual([231, 171, 188]);
  expect(splitDurations([])).toEqual([]);
  expect(worstRound([14, 11, 13])).toBe(11);
  expect(worstRound([])).toBeNull();
});

test('describeShape', () => {
  expect(
    describeShape([
      { ...defaultBlockConfig('exercises'), itemCount: 3 },
      { ...emom, itemCount: 2 },
      { ...defaultBlockConfig('exercises'), itemCount: 2 },
    ]),
  ).toBe('5 exercícios + EMOM 12 min');
  expect(describeShape([{ ...defaultBlockConfig('amrap'), itemCount: 3 }])).toBe('AMRAP 12 min');
  expect(describeShape([])).toBe('Vazio');
});

test('emomMovementIndex cycles through movements when alternating', () => {
  expect([1, 2, 3, 4, 5].map((r) => emomMovementIndex(r, 3, true))).toEqual([0, 1, 2, 0, 1]);
  expect(emomMovementIndex(2, 3, false)).toBeNull();
  expect(emomMovementIndex(1, 0, true)).toBeNull();
});

test('workoutIcon', () => {
  expect(workoutIcon(['emom', 'exercises'])).toBe('dumbbell');
  expect(workoutIcon(['amrap'])).toBe('timer-sand');
});
