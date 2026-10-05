import { and, asc, desc, eq, isNotNull, isNull, max } from 'drizzle-orm';

import { db } from '@/db/client';
import { sessions, sessionSets, type SessionSet } from '@/db/schema';
import { isNewPR, type PerformedSet } from '@/features/stats/prs';
import { getWorkoutDraft } from '@/features/workouts/repo';
import { createdFields, touched } from '@/lib/ids';

/** Completed sets of an exercise in strength sessions, oldest first. */
export async function performedSets(exerciseId: string, excludeSessionId?: string): Promise<PerformedSet[]> {
  const rows = await db
    .select({
      sessionId: sessionSets.sessionId,
      completedAt: sessionSets.completedAt,
      weight: sessionSets.weight,
      reps: sessionSets.reps,
    })
    .from(sessionSets)
    .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
    .where(
      and(
        eq(sessionSets.exerciseId, exerciseId),
        isNotNull(sessionSets.completedAt),
        isNull(sessionSets.deletedAt),
        isNull(sessions.deletedAt),
        eq(sessions.type, 'strength'),
      ),
    )
    .orderBy(asc(sessionSets.completedAt));
  return rows
    .filter((r) => r.sessionId !== excludeSessionId)
    .map((r) => ({ ...r, completedAt: r.completedAt ?? 0 }));
}

/** Last weight used for the exercise (suggested next time). */
async function lastWeight(exerciseId: string): Promise<number | null> {
  const sets = await performedSets(exerciseId);
  for (let i = sets.length - 1; i >= 0; i--) {
    if (sets[i].weight) return sets[i].weight;
  }
  return null;
}

export async function startSession(workoutId: string): Promise<string> {
  const w = await getWorkoutDraft(workoutId);
  if (!w) throw new Error('Treino não encontrado');

  const suggested = new Map<string, number | null>();
  if (w.type === 'strength') {
    for (const item of w.items) {
      if (item.weight == null && !suggested.has(item.exerciseId)) {
        suggested.set(item.exerciseId, await lastWeight(item.exerciseId));
      }
    }
  }

  return db.transaction(async (tx) => {
    const session = createdFields();
    await tx.insert(sessions).values({
      ...session,
      workoutId,
      name: w.name,
      type: w.type,
      durationSec: w.durationSec,
      intervalSec: w.intervalSec,
      rounds: w.rounds,
      timeCapSec: w.timeCapSec,
      startedAt: Date.now(),
      resultRounds: w.type === 'amrap' ? 0 : null,
      resultReps: w.type === 'amrap' ? 0 : null,
    });

    for (const [position, item] of w.items.entries()) {
      const count = w.type === 'strength' ? Math.max(1, item.sets ?? 1) : 1;
      for (let setIndex = 0; setIndex < count; setIndex++) {
        await tx.insert(sessionSets).values({
          ...createdFields(),
          sessionId: session.id,
          exerciseId: item.exerciseId,
          position,
          setIndex,
          reps: item.reps,
          weight: item.weight ?? suggested.get(item.exerciseId) ?? null,
          durationSec: item.durationSec,
          distanceM: item.distanceM,
          calories: item.calories,
          restSec: item.restSec,
        });
      }
    }
    return session.id;
  });
}

export async function getActiveSession() {
  return db.query.sessions.findFirst({
    where: and(isNull(sessions.finishedAt), isNull(sessions.deletedAt)),
    orderBy: desc(sessions.startedAt),
  });
}

type SetValues = Partial<Pick<SessionSet, 'reps' | 'weight' | 'durationSec' | 'distanceM' | 'calories'>>;

export async function updateSet(id: string, values: SetValues) {
  await db.update(sessionSets).set({ ...values, ...touched() }).where(eq(sessionSets.id, id));
}

/** Marks the set as done. Returns `true` if it is a new personal record. */
export async function completeSet(set: SessionSet): Promise<boolean> {
  const completedAt = Date.now();
  const previous = await performedSets(set.exerciseId, set.sessionId);
  await db.update(sessionSets).set({ completedAt, ...touched() }).where(eq(sessionSets.id, set.id));
  return isNewPR(previous, { ...set, completedAt });
}

export async function uncompleteSet(id: string) {
  await db.update(sessionSets).set({ completedAt: null, ...touched() }).where(eq(sessionSets.id, id));
}

/** Adds a set to the exercise, copying the values of the last one. */
export async function addSet(sessionId: string, position: number) {
  const last = await db.query.sessionSets.findFirst({
    where: and(
      eq(sessionSets.sessionId, sessionId),
      eq(sessionSets.position, position),
      isNull(sessionSets.deletedAt),
    ),
    orderBy: desc(sessionSets.setIndex),
  });
  if (!last) return;
  await db.insert(sessionSets).values({
    ...createdFields(),
    sessionId,
    exerciseId: last.exerciseId,
    position,
    setIndex: last.setIndex + 1,
    reps: last.reps,
    weight: last.weight,
    durationSec: last.durationSec,
    distanceM: last.distanceM,
    calories: last.calories,
    restSec: last.restSec,
  });
}

/** Appends a new exercise to an in-progress session. */
export async function addExerciseToSession(sessionId: string, exerciseId: string) {
  const [{ maxPos }] = await db
    .select({ maxPos: max(sessionSets.position) })
    .from(sessionSets)
    .where(eq(sessionSets.sessionId, sessionId));
  await db.insert(sessionSets).values({
    ...createdFields(),
    sessionId,
    exerciseId,
    position: (maxPos ?? -1) + 1,
    setIndex: 0,
    reps: 10,
    weight: await lastWeight(exerciseId),
    restSec: 90,
  });
}

export async function removeSet(id: string) {
  await db.update(sessionSets).set({ deletedAt: Date.now(), ...touched() }).where(eq(sessionSets.id, id));
}

export async function updateWodProgress(id: string, values: { resultRounds?: number; resultReps?: number }) {
  await db.update(sessions).set({ ...values, ...touched() }).where(eq(sessions.id, id));
}

export type SessionResult = {
  resultTimeSec?: number | null;
  resultRounds?: number | null;
  resultReps?: number | null;
  rx?: boolean;
  notes?: string | null;
};

export async function finishSession(id: string, result: SessionResult = {}) {
  const finishedAt = Date.now();
  await db.transaction(async (tx) => {
    await tx
      .update(sessions)
      .set({ ...result, finishedAt, ...touched() })
      .where(eq(sessions.id, id));
    // In WODs, the movements are recorded as done when the session finishes.
    const s = await tx.query.sessions.findFirst({ where: eq(sessions.id, id) });
    if (s && s.type !== 'strength') {
      await tx
        .update(sessionSets)
        .set({ completedAt: finishedAt, ...touched() })
        .where(and(eq(sessionSets.sessionId, id), isNull(sessionSets.completedAt)));
    }
  });
}

export async function deleteSession(id: string) {
  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.update(sessions).set({ deletedAt: now, ...touched() }).where(eq(sessions.id, id));
    await tx
      .update(sessionSets)
      .set({ deletedAt: now, ...touched() })
      .where(and(eq(sessionSets.sessionId, id), isNull(sessionSets.deletedAt)));
  });
}
