import { blocksOf, pickVariant, routineLocationIds, variantKeys, variantLocation } from './variants';

const b = (locationId: string | null, n: number) => ({ locationId, n });

describe('variantKeys', () => {
  it('always has the main variant first', () => {
    expect(variantKeys([])).toEqual([null]);
    expect(variantKeys([b('B', 1), b(null, 2), b('A', 3), b('B', 4)])).toEqual([null, 'B', 'A']);
  });
});

describe('blocksOf', () => {
  it('keeps the blocks of one variant in order', () => {
    const blocks = [b(null, 1), b('A', 2), b(null, 3), b('A', 4)];
    expect(blocksOf(blocks, null).map((x) => x.n)).toEqual([1, 3]);
    expect(blocksOf(blocks, 'A').map((x) => x.n)).toEqual([2, 4]);
    expect(blocksOf(blocks, 'Z')).toEqual([]);
  });
});

describe('pickVariant', () => {
  const keys = [null, 'B'];
  it('uses the current location’s own variant', () => {
    expect(pickVariant(keys, 'A', 'B')).toEqual({ variant: 'B', locationId: 'B' });
  });
  it('falls back to the main variant at the routine’s fixed location', () => {
    expect(pickVariant(keys, 'A', 'C')).toEqual({ variant: null, locationId: 'A' });
    expect(pickVariant(keys, 'A', null)).toEqual({ variant: null, locationId: 'A' });
  });
  it('uses the current location when the routine has no fixed one', () => {
    expect(pickVariant(keys, null, 'C')).toEqual({ variant: null, locationId: 'C' });
    expect(pickVariant([null], null, null)).toEqual({ variant: null, locationId: null });
  });
});

describe('variantLocation', () => {
  it('is the variant’s location, or the routine’s for the main one', () => {
    expect(variantLocation('B', 'A')).toBe('B');
    expect(variantLocation(null, 'A')).toBe('A');
    expect(variantLocation(null, null)).toBeNull();
  });
});

describe('routineLocationIds', () => {
  it('lists the fixed location and the variants without repeats', () => {
    expect(routineLocationIds('A', [null, 'B', 'A'])).toEqual(['A', 'B']);
    expect(routineLocationIds(null, [null])).toEqual([]);
  });
});
