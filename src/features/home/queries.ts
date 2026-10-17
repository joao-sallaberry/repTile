import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, max } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import {
  sessionBlocks,
  sessions,
  sessionSets,
  workoutBlocks,
  workoutItems,
  workouts,
  type Session,
  type SessionBlock,
  type SessionSet,
  type Workout,
  type WorkoutBlock,
} from '@/db/schema';

import { summarizeSets, weekBounds } from './stats';

const finished = and(isNotNull(sessions.finishedAt), isNull(sessions.deletedAt));

/** Completed sets of exercises blocks (WOD movements don't count for volume or load PRs). */
const plainSet = and(eq(sessionBlocks.kind, 'exercises'), isNull(sessionSets.deletedAt), isNotNull(sessionSets.completedAt));

/** Sessions, completed sets and WOD records of the current week (Monday-based). */
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
      .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionSets.sessionBlockId))
      .where(and(finished, gte(sessions.startedAt, start), plainSet)),
    [start],
  );
  const { data: wodPrs } = useLiveQuery(
    db
      .select({ id: sessionBlocks.id })
      .from(sessionBlocks)
      .innerJoin(sessions, eq(sessions.id, sessionBlocks.sessionId))
      .where(and(finished, gte(sessions.startedAt, start), eq(sessionBlocks.isPr, true), isNull(sessionBlocks.deletedAt))),
    [start],
  );

  return useMemo(() => {
    const sets = weekSets.map((r) => r.set);
    return {
      sessions: weekSessions,
      trainedSec: weekSessions.reduce((acc, s) => acc + ((s.finishedAt ?? s.startedAt) - s.startedAt) / 1000, 0),
      volume: summarizeSets(sets).volume,
      prs: countPrs(sets) + wodPrs.length,
    };
  }, [weekSessions, weekSets, wodPrs]);
}

/** One PR per exercise and session, however many record sets it had. */
function countPrs(sets: Pick<SessionSet, 'isPr' | 'sessionId' | 'exerciseId'>[]) {
  return new Set(sets.filter((s) => s.isPr).map((s) => `${s.sessionId}:${s.exerciseId}`)).size;
}

export type RoutineBlock = WorkoutBlock & { itemCount: number };
export type RoutineRow = Workout & { lastDoneAt: number | null; exerciseCount: number; blocks: RoutineBlock[] };

/** Saved routines with their blocks and when each was last done, most recently done first (never done last). */
export function useRoutines(): RoutineRow[] {
  const { data: list } = useLiveQuery(db.select().from(workouts).where(isNull(workouts.deletedAt)));
  const { data: last } = useLiveQuery(
    db
      .select({ workoutId: sessions.workoutId, at: max(sessions.startedAt) })
      .from(sessions)
      .where(and(finished, isNotNull(sessions.workoutId)))
      .groupBy(sessions.workoutId),
  );
  const { data: blocks } = useLiveQuery(
    db.select().from(workoutBlocks).where(isNull(workoutBlocks.deletedAt)).orderBy(asc(workoutBlocks.position)),
  );
  const { data: counts } = useLiveQuery(
    db
      .select({ blockId: workoutItems.blockId, n: count() })
      .from(workoutItems)
      .where(isNull(workoutItems.deletedAt))
      .groupBy(workoutItems.blockId),
  );

  return useMemo(() => {
    const lastBy = new Map(last.map((l) => [l.workoutId, l.at]));
    const countBy = new Map(counts.map((c) => [c.blockId, c.n]));
    const blocksBy = new Map<string, RoutineBlock[]>();
    for (const b of blocks) {
      blocksBy.set(b.workoutId, [...(blocksBy.get(b.workoutId) ?? []), { ...b, itemCount: countBy.get(b.id) ?? 0 }]);
    }
    return list
      .map((w) => {
        const wb = blocksBy.get(w.id) ?? [];
        return {
          ...w,
          blocks: wb,
          lastDoneAt: lastBy.get(w.id) ?? null,
          exerciseCount: wb.filter((b) => b.kind === 'exercises').reduce((n, b) => n + b.itemCount, 0),
        };
      })
      .sort((a, b) => (b.lastDoneAt ?? -1) - (a.lastDoneAt ?? -1) || b.updatedAt - a.updatedAt);
  }, [list, last, blocks, counts]);
}

export type RecentPr =
  | { kind: 'set'; key: string; at: number; exerciseId: string; machineId: string | null; weight: number; reps: number }
  | { kind: 'wod'; key: string; at: number; block: SessionBlock; sessionId: string; sessionName: string };

/** Latest records: the best record set per exercise + machine, plus WOD block records. */
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
      .select({ block: sessionBlocks, sessionName: sessions.name })
      .from(sessionBlocks)
      .innerJoin(sessions, eq(sessions.id, sessionBlocks.sessionId))
      .where(and(finished, eq(sessionBlocks.isPr, true), isNull(sessionBlocks.deletedAt)))
      .orderBy(desc(sessionBlocks.finishedAt))
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
    const wods: RecentPr[] = wodRows.map(({ block, sessionName }) => ({
      kind: 'wod',
      key: block.id,
      at: block.finishedAt ?? 0,
      block,
      sessionId: block.sessionId,
      sessionName,
    }));
    return [...byKey.values(), ...wods].sort((a, b) => b.at - a.at).slice(0, limit);
  }, [setRows, wodRows, limit]);
}

export type RecentSession = Session & { volume: number; sets: number; prs: number; wods: SessionBlock[] };

/** Last finished sessions with their volume, working sets, WOD blocks and PR count. */
export function useRecentSessions(limit = 5): RecentSession[] {
  const { data: list } = useLiveQuery(
    db.select().from(sessions).where(finished).orderBy(desc(sessions.startedAt)).limit(limit),
    [limit],
  );
  const ids = list.map((s) => s.id);
  const key = ids.join(',');
  const { data: setRows } = useLiveQuery(
    db
      .select({ set: sessionSets })
      .from(sessionSets)
      .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionSets.sessionBlockId))
      .where(and(inArray(sessionSets.sessionId, ids), eq(sessionBlocks.kind, 'exercises'), isNull(sessionSets.deletedAt))),
    [key],
  );
  const { data: blockRows } = useLiveQuery(
    db
      .select()
      .from(sessionBlocks)
      .where(and(inArray(sessionBlocks.sessionId, ids), isNull(sessionBlocks.deletedAt)))
      .orderBy(asc(sessionBlocks.position)),
    [key],
  );

  return useMemo(() => {
    const setsBy = new Map<string, SessionSet[]>();
    for (const { set } of setRows) setsBy.set(set.sessionId, [...(setsBy.get(set.sessionId) ?? []), set]);
    const wodsBy = new Map<string, SessionBlock[]>();
    for (const b of blockRows) if (b.kind !== 'exercises') wodsBy.set(b.sessionId, [...(wodsBy.get(b.sessionId) ?? []), b]);
    return list.map((s) => {
      const sets = setsBy.get(s.id) ?? [];
      const wods = wodsBy.get(s.id) ?? [];
      return { ...s, ...summarizeSets(sets), wods, prs: countPrs(sets) + wods.filter((w) => w.isPr).length };
    });
  }, [list, setRows, blockRows]);
}
