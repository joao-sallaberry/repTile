import { pickMediaId, type MediaMap } from './media-map';

const map: MediaMap = { 'seed-barbell-curl': { barbell: 'barbell-curl', dumbbell: 'bicep-curl' } };

test('pickMediaId: per equipment, else the first one', () => {
  expect(pickMediaId('seed-barbell-curl', 'dumbbell', map)).toBe('bicep-curl');
  expect(pickMediaId('seed-barbell-curl', 'cable', map)).toBe('barbell-curl');
  expect(pickMediaId('seed-barbell-curl', null, map)).toBe('barbell-curl');
  expect(pickMediaId('custom', 'barbell', map)).toBeUndefined();
});

test('every seed exercise in the map has an id per equipment', () => {
  for (const ids of Object.values(require('./media-map.json') as MediaMap)) {
    expect(Object.keys(ids).length).toBeGreaterThan(0);
  }
});
