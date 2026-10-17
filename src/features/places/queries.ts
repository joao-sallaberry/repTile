import { asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { locations, machines, type Location, type Machine } from '@/db/schema';

export const LOCATION_KIND_LABEL = { gym: 'Academia', box: 'Box de crossfit' } as const;

export function useLocations(): Location[] {
  const { data } = useLiveQuery(
    db.select().from(locations).where(isNull(locations.deletedAt)).orderBy(asc(locations.name)),
  );
  return data;
}

export function useLocation(id: string | null | undefined): Location | undefined {
  const { data } = useLiveQuery(db.select().from(locations).where(eq(locations.id, id ?? '')), [id]);
  return id ? data[0] : undefined;
}

export function useMachineMap(): Map<string, Machine> {
  const { data } = useLiveQuery(db.select().from(machines));
  return useMemo(() => new Map(data.map((m) => [m.id, m])), [data]);
}
