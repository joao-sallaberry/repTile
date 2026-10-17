import { and, asc, desc, eq, gt, isNotNull, isNull, max, ne, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { sessions, sessionSets, type SessionSet, type SetType } from '@/db/schema';
import { linkMachineToExercise, linkMachineToLocation } from '@/features/places/repo';
import { isNewPR, isWodPR, type PerformedSet } from '@/features/stats/prs';
import { getWorkoutDraft, newSet, saveWorkout, type WorkoutItemDraft } from '@/features/workouts/repo';
import { createdFields, touched } from '@/lib/ids';

import { countsTowardStats, pairPrevious } from './sets';

export type PerformedSetRow = PerformedSet & { type: SetType; machineId: string | null; setIndex: number };

/**
 * Completed sets of an exercise in strength sessions, oldest first.
 * `machineId`: `undefined` = any machine; `null` = only sets done without a machine.
 */
export async function performedSets(
  exerciseId: string,
  opts: { machineId?: string | null; excludeSessionId?: string } = {},
): Promise<PerformedSetRow[]> {
  const rows = await db
    .select({
      sessionId: sessionSets.sessionId,
      completedAt: sessionSets.completedAt,
      weight: sessionSets.weight,
      reps: sessionSets.reps,
      type: sessionSets.type,
      machineId: sessionSets.machineId,
      setIndex: sessionSets.setIndex,
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
        opts.machineId === undefined
          ? undefined
          : opts.machineId === null
            ? isNull(sessionSets.machineId)
            : eq(sessionSets.machineId, opts.machineId),
      ),
    )
    .orderBy(asc(sessionSets.completedAt));
  return rows
    .filter((r) => r.sessionId !== opts.excludeSessionId)
    .map((r) => ({ ...r, completedAt: r.completedAt ?? 0 }));
}

/** Sets of the most recent other session with this exercise on this machine, in set order. */
export async function previousSessionSets(
  exerciseId: string,
  machineId: string | null,
  excludeSessionId?: string,
): Promise<PerformedSetRow[]> {
  const all = await performedSets(exerciseId, { machineId, excludeSessionId });
  const last = all.at(-1);
  if (!last) return [];
  return all.filter((r) => r.sessionId === last.sessionId).sort((a, b) => a.setIndex - b.setIndex);
}

export async function startSession(workoutId: string, fallbackLocationId: string | null = null): Promise<string> {
  const w = await getWorkoutDraft(workoutId);
  if (!w) throw new Error('Treino não encontrado');

  // Pre-fill each set from the routine target, else from the same set last time on the same machine.
  const previous = await Promise.all(
    w.items.map((item) =>
      w.type === 'strength' ? previousSessionSets(item.exerciseId, item.machineId) : Promise.resolve([]),
    ),
  );

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
      locationId: w.locationId ?? fallbackLocationId,
      startedAt: Date.now(),
      resultRounds: w.type === 'amrap' ? 0 : null,
      resultReps: w.type === 'amrap' ? 0 : null,
    });

    for (const [position, item] of w.items.entries()) {
      const base = { sessionId: session.id, exerciseId: item.exerciseId, machineId: item.machineId, position, restSec: item.restSec };
      if (w.type !== 'strength') {
        const { reps, weight, durationSec, distanceM, calories } = item;
        await tx.insert(sessionSets).values({ ...createdFields(), ...base, setIndex: 0, reps, weight, durationSec, distanceM, calories });
        continue;
      }
      const paired = pairPrevious(item.sets, previous[position]);
      for (const [setIndex, target] of item.sets.entries()) {
        const prev = paired[setIndex];
        await tx.insert(sessionSets).values({
          ...createdFields(),
          ...base,
          setIndex,
          type: target.type,
          reps: target.reps ?? prev?.reps ?? null,
          // A 0 kg target means "no target": use last time's load.
          weight: target.weight || prev?.weight || 0,
          durationSec: target.durationSec,
          distanceM: target.distanceM,
          calories: target.calories,
        });
      }
    }
    return session.id;
  });
}

/** Starts a strength session with no routine ("Treino livre"); exercises are added during it. */
export async function startEmptySession(locationId: string | null = null): Promise<string> {
  const session = createdFields();
  await db.insert(sessions).values({
    ...session,
    workoutId: null,
    name: 'Treino livre',
    type: 'strength',
    locationId,
    startedAt: Date.now(),
  });
  return session.id;
}

/** Creates a strength routine from what was done in a session (e.g. after a "Treino livre"). */
export async function saveSessionAsRoutine(sessionId: string, name: string): Promise<string> {
  const rows = await db.query.sessionSets.findMany({
    where: and(eq(sessionSets.sessionId, sessionId), isNull(sessionSets.deletedAt)),
    orderBy: [asc(sessionSets.position), asc(sessionSets.setIndex)],
  });
  const byPosition = new Map<number, WorkoutItemDraft>();
  for (const r of rows) {
    let item = byPosition.get(r.position);
    if (!item) {
      item = {
        exerciseId: r.exerciseId,
        machineId: r.machineId,
        sets: [],
        reps: null,
        weight: null,
        durationSec: null,
        distanceM: null,
        calories: null,
        restSec: r.restSec,
        notes: null,
      };
      byPosition.set(r.position, item);
    }
    const { reps, weight, durationSec, distanceM, calories } = r;
    item.sets.push(newSet(r.type, { reps, weight, durationSec, distanceM, calories }));
  }
  const id = await saveWorkout(null, {
    name,
    type: 'strength',
    notes: null,
    durationSec: null,
    intervalSec: null,
    rounds: null,
    timeCapSec: null,
    locationId: null,
    items: [...byPosition.values()],
  });
  // The session now counts as a run of the new routine (rotation, history).
  await db.update(sessions).set({ workoutId: id, name, ...touched() }).where(eq(sessions.id, sessionId));
  return id;
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
  await refreshSetPr(id);
}

/** Whether a completed set beats the earlier sessions on the same exercise and machine. */
async function isSetPr(set: SessionSet, completedAt: number): Promise<boolean> {
  if (!countsTowardStats(set.type)) return false;
  const previous = await performedSets(set.exerciseId, { machineId: set.machineId, excludeSessionId: set.sessionId });
  return isNewPR(
    previous.filter((p) => countsTowardStats(p.type)),
    { ...set, completedAt },
  );
}

/** Re-evaluates the stored PR flag after a completed set is edited. */
async function refreshSetPr(id: string) {
  const set = await db.query.sessionSets.findFirst({ where: eq(sessionSets.id, id) });
  if (!set?.completedAt) return;
  const isPr = await isSetPr(set, set.completedAt);
  if (isPr !== set.isPr) await db.update(sessionSets).set({ isPr, ...touched() }).where(eq(sessionSets.id, id));
}

/** Marks the set as done. Returns `true` if it is a new personal record (same machine, warm-ups excluded). */
export async function completeSet(set: SessionSet): Promise<boolean> {
  const completedAt = Date.now();
  const isPr = await isSetPr(set, completedAt);
  await db.update(sessionSets).set({ completedAt, isPr, ...touched() }).where(eq(sessionSets.id, set.id));
  return isPr;
}

export async function setSetType(id: string, type: SetType) {
  await db.update(sessionSets).set({ type, ...touched() }).where(eq(sessionSets.id, id));
  await refreshSetPr(id);
}

/** Sets the machine for every set of an exercise in the session, and links it to the exercise and location. */
export async function setExerciseMachine(sessionId: string, position: number, exerciseId: string, machineId: string | null) {
  await db
    .update(sessionSets)
    .set({ machineId, ...touched() })
    .where(and(eq(sessionSets.sessionId, sessionId), eq(sessionSets.position, position), isNull(sessionSets.deletedAt)));
  if (!machineId) return;
  await linkMachineToExercise(machineId, exerciseId);
  const s = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (s?.locationId) await linkMachineToLocation(machineId, s.locationId);
}

export async function setSessionLocation(sessionId: string, locationId: string | null) {
  await db.update(sessions).set({ locationId, ...touched() }).where(eq(sessions.id, sessionId));
}

export async function uncompleteSet(id: string) {
  await db.update(sessionSets).set({ completedAt: null, isPr: false, ...touched() }).where(eq(sessionSets.id, id));
}

/**
 * Adds a set to the exercise, copying the last set of the same type (or the last set).
 * Warm-ups are inserted right after the existing warm-ups, before the working sets.
 */
export async function addSet(sessionId: string, position: number, type: SetType = 'normal') {
  const current = await db.query.sessionSets.findMany({
    where: and(eq(sessionSets.sessionId, sessionId), eq(sessionSets.position, position), isNull(sessionSets.deletedAt)),
    orderBy: asc(sessionSets.setIndex),
  });
  if (!current.length) return;
  const sameType = current.filter((c) => c.type === type);
  const last = sameType.at(-1) ?? current.at(-1)!;
  const insertAfter = type === 'warmup' ? (sameType.at(-1)?.setIndex ?? -1) : current.at(-1)!.setIndex;
  // Make room: shift the following sets down by one.
  await db
    .update(sessionSets)
    .set({ setIndex: sql`${sessionSets.setIndex} + 1`, ...touched() })
    .where(
      and(
        eq(sessionSets.sessionId, sessionId),
        eq(sessionSets.position, position),
        isNull(sessionSets.deletedAt),
        gt(sessionSets.setIndex, insertAfter),
      ),
    );
  await db.insert(sessionSets).values({
    ...createdFields(),
    sessionId,
    exerciseId: last.exerciseId,
    machineId: last.machineId,
    position,
    setIndex: insertAfter + 1,
    type,
    reps: last.reps,
    weight: last.weight ?? 0,
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
    weight: (await previousSessionSets(exerciseId, null)).find((p) => countsTowardStats(p.type))?.weight ?? 0,
    restSec: 90,
  });
}

/** Removes an exercise (all its sets) from an in-progress session. */
export async function removeExercise(sessionId: string, position: number) {
  await db
    .update(sessionSets)
    .set({ deletedAt: Date.now(), ...touched() })
    .where(and(eq(sessionSets.sessionId, sessionId), eq(sessionSets.position, position), isNull(sessionSets.deletedAt)));
}

export async function removeSet(id: string) {
  await db.update(sessionSets).set({ deletedAt: Date.now(), ...touched() }).where(eq(sessionSets.id, id));
}

export async function updateWodProgress(id: string, values: { resultRounds?: number; resultReps?: number }) {
  await db.update(sessions).set({ ...values, ...touched() }).where(eq(sessions.id, id));
}

export type SessionResult = {
  /** Adjusted start/end times (ms); default: keep the start, end now. */
  startedAt?: number;
  finishedAt?: number;
  resultTimeSec?: number | null;
  resultRounds?: number | null;
  resultReps?: number | null;
  rx?: boolean;
  notes?: string | null;
};

export async function finishSession(id: string, { finishedAt = Date.now(), ...result }: SessionResult = {}) {
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
      if (s.workoutId) {
        const previous = await tx.query.sessions.findMany({
          where: and(
            eq(sessions.workoutId, s.workoutId),
            ne(sessions.id, id),
            isNotNull(sessions.finishedAt),
            isNull(sessions.deletedAt),
          ),
        });
        const isPr = isWodPR(s.type, s, previous);
        if (isPr) await tx.update(sessions).set({ isPr, ...touched() }).where(eq(sessions.id, id));
      }
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
