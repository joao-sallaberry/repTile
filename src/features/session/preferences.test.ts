import { startsRest } from './preferences';

jest.mock('expo-sqlite/kv-store', () => ({ default: {} }));

test('startsRest: warm-ups follow the setting, other sets always rest', () => {
  expect(startsRest('warmup', { restAfterWarmup: true })).toBe(true);
  expect(startsRest('warmup', { restAfterWarmup: false })).toBe(false);
  for (const t of ['normal', 'drop', 'failure'] as const) expect(startsRest(t, { restAfterWarmup: false })).toBe(true);
});
