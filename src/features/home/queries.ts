import { and, count, desc, eq, gte, inArray, isNotNull, isNull, max } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { sessions, sessionSets, workoutItems, workouts, type Session, type SessionSet, type Workout } from '@/db/schema';

import { summarizeSets, weekBounds } from './stats';

const finished = and(isNotNull(sessions.finishedAt), isNull(sessions.deletedAt));

/** Sessions and completed sets of the current week (Sunday-based). */
export function useWeekSummary(now: number) {
  const { start } = weekBounds(now);
  const { data: weekSessions } = useLiveQuery(
    db.select().from(sessions).where(and(finished, gte(sessions.startedAt, start))),
    [start],
  );
  const { data: weekSets } = useLiveQuery(
    db
      .select({ set: sessionSets })
      .from(sessionSets)
      .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
      .where(
        and(
          finished,
          gte(sessions.startedAt, start),
          eq(sessions.type, 'strength'),
          isNull(sessionSets.deletedAt),
          isNotNull(sessionSets.completedAt),
        ),
      ),
    [start],
  );

  return useMemo(() => {
    const sets = weekSets.map((r) => r.set);
    return {
      sessions: weekSessions,
      trainedSec: weekSessions.reduce((acc, s) => acc + ((s.finishedAt ?? s.startedAt) - s.startedAt) / 1000, 0),
      volume: summarizeSets(sets).volume,
      prs: countPrs(sets) + weekSessions.filter((s) => s.isPr).length,
    };
  }, [weekSessions, weekSets]);
}

/** One PR per exercise and session, however many record sets it had. */
function countPrs(sets: Pick<SessionSet, 'isPr' | 'sessionId' | 'exerciseId'>[]) {
  return new Set(sets.filter((s) => s.isPr).map((s) => `${s.sessionId}:${s.exerciseId}`)).size;
}

export type RoutineRow = Workout & { lastDoneAt: number | null; exerciseCount: number };

/** Saved routines with when each was last done, most recently done first (never done last). */
export function useRoutines(): RoutineRow[] {
  const { data: list } = useLiveQuery(db.select().from(workouts).where(isNull(workouts.deletedAt)));
  const { data: last } = useLiveQuery(
    db
      .select({ workoutId: sessions.workoutId, at: max(sessions.startedAt) })
      .from(sessions)
      .where(and(finished, isNotNull(sessions.workoutId)))
      .groupBy(sessions.workoutId),
  );
  const { data: counts } = useLiveQuery(
    db
      .select({ workoutId: workoutItems.workoutId, n: count() })
      .from(workoutItems)
      .where(isNull(workoutItems.deletedAt))
      .groupBy(workoutItems.workoutId),
  );

  return useMemo(() => {
    const lastBy = new Map(last.map((l) => [l.workoutId, l.at]));
    const countBy = new Map(counts.map((c) => [c.workoutId, c.n]));
    return list
      .map((w) => ({ ...w, lastDoneAt: lastBy.get(w.id) ?? null, exerciseCount: countBy.get(w.id) ?? 0 }))
      .sort((a, b) => (b.lastDoneAt ?? -1) - (a.lastDoneAt ?? -1) || b.updatedAt - a.updatedAt);
  }, [list, last, counts]);
}

export type RecentPr =
  | { kind: 'set'; key: string; at: number; exerciseId: string; machineId: string | null; weight: number; reps: number }
  | { kind: 'wod'; key: string; at: number; session: Session };

/** Latest records: the best record set per exercise + machine, plus WOD records. */
export function useRecentPrs(limit = 6): RecentPr[] {
  const { data: setRows } = useLiveQuery(
    db
      .select({ set: sessionSets })
      .from(sessionSets)
      .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
      .where(and(eq(sessionSets.isPr, true), isNull(sessionSets.deletedAt), isNull(sessions.deletedAt)))
      .orderBy(desc(sessionSets.completedAt))
      .limit(60),
  );
  const { data: wodRows } = useLiveQuery(
    db
      .select()
      .from(sessions)
      .where(and(finished, eq(sessions.isPr, true)))
      .orderBy(desc(sessions.startedAt))
      .limit(limit),
  );

  return useMemo(() => {
    // Rows are newest first: keep, per exercise + machine, the heaviest record set of its newest session.
    const byKey = new Map<string, RecentPr & { kind: 'set'; sessionId: string }>();
    for (const { set } of setRows) {
      const key = `${set.exerciseId}:${set.machineId ?? ''}`;
      const cur = byKey.get(key);
      const weight = set.weight ?? 0;
      if (cur && (cur.sessionId !== set.sessionId || weight <= cur.weight)) continue;
      byKey.set(key, {
        kind: 'set',
        key,
        sessionId: set.sessionId,
        at: set.completedAt ?? 0,
        exerciseId: set.exerciseId,
        machineId: set.machineId,
        weight,
        reps: set.reps ?? 0,
      });
    }
    const wods: RecentPr[] = wodRows.map((s) => ({ kind: 'wod', key: s.id, at: s.finishedAt ?? s.startedAt, session: s }));
    return [...byKey.values(), ...wods].sort((a, b) => b.at - a.at).slice(0, limit);
  }, [setRows, wodRows, limit]);
}

export type RecentSession = Session & { volume: number; sets: number; prs: number };

/** Last finished sessions with their volume, working sets and PR count. */
export function useRecentSessions(limit = 5): RecentSession[] {
  const { data: list } = useLiveQuery(
    db.select().from(sessions).where(finished).orderBy(desc(sessions.startedAt)).limit(limit),
    [limit],
  );
  const ids = list.map((s) => s.id);
  const { data: setRows } = useLiveQuery(
    db
      .select()
      .from(sessionSets)
      .where(and(inArray(sessionSets.sessionId, ids), isNull(sessionSets.deletedAt))),
    [ids.join(',')],
  );

  return useMemo(() => {
    const bySession = new Map<string, SessionSet[]>();
    for (const s of setRows) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
    return list.map((s) => {
      const sets = bySession.get(s.id) ?? [];
      const summary = s.type === 'strength' ? summarizeSets(sets) : { volume: 0, sets: 0 };
      return { ...s, ...summary, prs: countPrs(sets) + (s.isPr ? 1 : 0) };
    });
  }, [list, setRows]);
}
