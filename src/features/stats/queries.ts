// SPDX-License-Identifier: AGPL-3.0-or-later
import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { sessionBlocks, sessions, sessionSets } from '@/db/schema';

import { exerciseMarks, type ExerciseMark } from './exercise-list';

/** Best set and last use of every exercise (`exerciseMarks`), from the completed working sets of exercises blocks. */
export function useExerciseMarks(now: number): Map<string, ExerciseMark> {
  const { data } = useLiveQuery(
    db
      .select({
        exerciseId: sessionSets.exerciseId,
        sessionId: sessionSets.sessionId,
        completedAt: sessionSets.completedAt,
        weight: sessionSets.weight,
        reps: sessionSets.reps,
      })
      .from(sessionSets)
      .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
      .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionSets.sessionBlockId))
      .where(
        and(
          isNotNull(sessionSets.completedAt),
          isNull(sessionSets.deletedAt),
          isNull(sessions.deletedAt),
          eq(sessionBlocks.kind, 'exercises'),
          ne(sessionSets.type, 'warmup'),
        ),
      ),
  );
  return useMemo(() => exerciseMarks(data.map((r) => ({ ...r, completedAt: r.completedAt ?? 0 })), now), [data, now]);
}
