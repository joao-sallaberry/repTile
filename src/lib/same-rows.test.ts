import { samePropsByRows, sameRow, sameRows } from './same-rows';

const set = (id: string, completedAt: number | null = null) => ({ id, completedAt, weight: 45, reps: 10 });

describe('sameRow', () => {
  it('compares flat rows by value', () => {
    expect(sameRow(set('a'), set('a'))).toBe(true);
    expect(sameRow(set('a'), set('a', 1))).toBe(false);
    expect(sameRow({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });

  it('compares nested values by identity', () => {
    expect(sameRow({ splits: [1] }, { splits: [1] })).toBe(false);
  });
});

describe('sameRows', () => {
  it('needs the same rows in the same order', () => {
    expect(sameRows([set('a'), set('b')], [set('a'), set('b')])).toBe(true);
    expect(sameRows([set('a'), set('b')], [set('b'), set('a')])).toBe(false);
    expect(sameRows([set('a')], [set('a'), set('b')])).toBe(false);
  });
});

describe('samePropsByRows', () => {
  const onToggle = () => {};

  it('skips a card whose rows only came back as new objects', () => {
    expect(samePropsByRows({ sets: [set('a')], onToggle }, { sets: [set('a')], onToggle })).toBe(true);
  });

  it('re-renders when a row or another prop changes', () => {
    expect(samePropsByRows({ sets: [set('a')], onToggle }, { sets: [set('a', 1)], onToggle })).toBe(false);
    expect(samePropsByRows({ sets: [set('a')], onToggle }, { sets: [set('a')], onToggle: () => {} })).toBe(false);
    expect(samePropsByRows({ name: 'x' }, { name: 'y' })).toBe(false);
  });
});
