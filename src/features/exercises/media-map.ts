import type { Equipment } from '@/db/schema';

import MEDIA_MAP from './media-map.json';

export type MediaMap = Record<string, Partial<Record<Equipment, string>>>;

/**
 * The RepDB illustration of an exercise done with `equipment`: its own, else the default equipment's
 * (the first mapped). Custom exercises have none.
 */
export function pickMediaId(exerciseId: string, equipment: Equipment | null | undefined, map: MediaMap = MEDIA_MAP): string | undefined {
  const byEquipment = map[exerciseId];
  if (!byEquipment) return undefined;
  return (equipment && byEquipment[equipment]) || Object.values(byEquipment)[0];
}

/** Equipment the exercise has an illustration of. */
export const mediaEquipment = (exerciseId: string, map: MediaMap = MEDIA_MAP) => Object.keys(map[exerciseId] ?? {}) as Equipment[];
