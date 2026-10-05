import { asc, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { exercises, type Exercise } from '@/db/schema';

export function useExercises() {
  const { data } = useLiveQuery(
    db.select().from(exercises).where(isNull(exercises.deletedAt)).orderBy(asc(exercises.category), asc(exercises.name)),
  );
  return data;
}

export function useExerciseMap(): Map<string, Exercise> {
  const list = useExercises();
  return useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
}
