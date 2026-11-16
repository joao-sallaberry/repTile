/**
 * Live queries return new row objects every time they rerun, even when nothing in them changed.
 * These compare rows by value so `memo` can skip cards whose rows are the same.
 */

/** Same flat row: the same own keys with identical values (nested objects compare by identity). */
export function sameRow(a: object, b: object): boolean {
  if (a === b) return true;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Same rows in the same order. */
export function sameRows(a: readonly object[], b: readonly object[]): boolean {
  return a === b || (a.length === b.length && a.every((row, i) => sameRow(row, b[i])));
}

/** `memo` comparator: props equal by identity, except arrays, compared row by row with `sameRows`. */
export function samePropsByRows<P extends object>(a: P, b: P): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => {
    const x = (a as Record<string, unknown>)[k];
    const y = (b as Record<string, unknown>)[k];
    return Object.is(x, y) || (Array.isArray(x) && Array.isArray(y) && sameRows(x, y));
  });
}
