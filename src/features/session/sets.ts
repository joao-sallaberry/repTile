import type { SetType } from '@/db/schema';

/** Warm-up sets are logged but don't count towards volume or PRs. */
export const countsTowardStats = (type: SetType) => type !== 'warmup';

export const SET_TYPE_LABEL: Record<SetType, string> = {
  warmup: 'Aquecimento',
  normal: 'Normal',
  drop: 'Drop set',
  failure: 'Até a falha',
};

/**
 * Badge shown in the "Série" column: W (warm-up), D (drop set), F (to failure),
 * and normal sets numbered among themselves (1, 2, 3…).
 */
export function setLabels(types: SetType[]): string[] {
  let n = 0;
  return types.map((t) => {
    if (t === 'warmup') return 'W';
    if (t === 'drop') return 'D';
    if (t === 'failure') return 'F';
    n += 1;
    return String(n);
  });
}

/**
 * Pairs each current set with the set of the same type and order in a previous session
 * (2nd warm-up ↔ 2nd warm-up, 3rd normal ↔ 3rd normal) for the "Anterior" column.
 */
export function pairPrevious<T extends { type: SetType }>(current: { type: SetType }[], previous: T[]): (T | null)[] {
  const byType = new Map<SetType, T[]>();
  for (const p of previous) byType.set(p.type, [...(byType.get(p.type) ?? []), p]);
  const seen = new Map<SetType, number>();
  return current.map(({ type }) => {
    const k = seen.get(type) ?? 0;
    seen.set(type, k + 1);
    return byType.get(type)?.[k] ?? null;
  });
}
