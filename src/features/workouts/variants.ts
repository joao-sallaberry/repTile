/**
 * Location variants of a routine (ADR 0020). A routine's blocks are grouped by `locationId`: `null` is the main
 * variant (done at the routine's fixed location, or anywhere), any other value is that location's own version of
 * the routine. Pure helpers, tested.
 */

/** A variant: `null` = the main one, else a location id. */
export type VariantKey = string | null;

/** The routine's variants: the main one first (it always exists), then the others in the order they appear. */
export function variantKeys(blocks: { locationId: string | null }[]): VariantKey[] {
  const keys: VariantKey[] = [null];
  for (const b of blocks) if (b.locationId != null && !keys.includes(b.locationId)) keys.push(b.locationId);
  return keys;
}

/** The blocks of one variant, in their order. */
export function blocksOf<T extends { locationId: string | null }>(blocks: T[], key: VariantKey): T[] {
  return blocks.filter((b) => (b.locationId ?? null) === key);
}

/**
 * Which variant to start, and where the session takes place. At a location with its own variant, that one;
 * otherwise the main variant at the routine's fixed location (else the current one).
 */
export function pickVariant(
  keys: VariantKey[],
  routineLocationId: string | null,
  currentLocationId: string | null,
): { variant: VariantKey; locationId: string | null } {
  if (currentLocationId != null && keys.includes(currentLocationId)) {
    return { variant: currentLocationId, locationId: currentLocationId };
  }
  return { variant: null, locationId: routineLocationId ?? currentLocationId };
}

/** Where a variant is done: its own location, or the routine's fixed one for the main variant. */
export const variantLocation = (key: VariantKey, routineLocationId: string | null): string | null =>
  key ?? routineLocationId;

/** Every location the routine is set up for (fixed location first, then the variants'), without repeats. */
export function routineLocationIds(routineLocationId: string | null, keys: VariantKey[]): string[] {
  const ids = [routineLocationId, ...keys].filter((k): k is string => k != null);
  return [...new Set(ids)];
}
