import { and, asc, desc, eq, gt, isNotNull, isNull, max, ne, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  sessionBlocks,
  sessions,
  sessionSets,
  workoutBlocks,
  type BlockKind,
  type SessionSet,
  type SetType,
} from '@/db/schema';
import { linkMachineToExercise, linkMachineToLocation } from '@/features/places/repo';
import { isNewPR, isWodPR, type PerformedSet } from '@/features/stats/prs';
import { cleanBlockConfig, defaultBlockConfig, isWod, type BlockConfig } from '@/features/workouts/blocks';
import {
  emptyBlock,
  getWorkoutDraft,
  newSet,
  saveWorkout,
  type BlockDraft,
  type WorkoutItemDraft,
} from '@/features/workouts/repo';
import { createdFields, touched } from '@/lib/ids';

import { countsTowardStats, pairPrevious } from './sets';

export type PerformedSetRow = PerformedSet & { type: SetType; machineId: string | null; setIndex: number };

/**
 * Completed sets of an exercise in exercises blocks (not WODs), oldest first.
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
    .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionSets.sessionBlockId))
    .where(
      and(
        eq(sessionSets.exerciseId, exerciseId),
        isNotNull(sessionSets.completedAt),
        isNull(sessionSets.deletedAt),
        isNull(sessions.deletedAt),
        eq(sessionBlocks.kind, 'exercises'),
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

const configOf = (b: BlockConfig): BlockConfig => {
  const { kind, durationSec, intervalSec, rounds, timeCapSec, workSec, restSec, alternate } = cleanBlockConfig(b);
  return { kind, durationSec, intervalSec, rounds, timeCapSec, workSec, restSec, alternate };
};

export async function startSession(workoutId: string, fallbackLocationId: string | null = null): Promise<string> {
  const w = await getWorkoutDraft(workoutId);
  if (!w) throw new Error('Treino não encontrado');

  // Pre-fill each set from the routine target, else from the same set last time on the same machine.
  const previous = await Promise.all(
    w.blocks.map((b) =>
      Promise.all(
        b.items.map((item) =>
          b.kind === 'exercises' ? previousSessionSets(item.exerciseId, item.machineId) : Promise.resolve([]),
        ),
      ),
    ),
  );

  return db.transaction(async (tx) => {
    const session = createdFields();
    await tx.insert(sessions).values({
      ...session,
      workoutId,
      name: w.name,
      locationId: w.locationId ?? fallbackLocationId,
      startedAt: Date.now(),
    });

    // Positions are unique across the session's blocks (they group the sets of one exercise).
    let position = 0;
    for (const [blockPos, block] of w.blocks.entries()) {
      const sessionBlock = createdFields();
      await tx.insert(sessionBlocks).values({
        ...sessionBlock,
        ...configOf(block),
        sessionId: session.id,
        workoutBlockId: block.id ?? null,
        position: blockPos,
        notes: block.notes,
        resultRounds: block.kind === 'amrap' ? 0 : null,
        resultReps: block.kind === 'amrap' ? 0 : null,
      });

      for (const [itemPos, item] of block.items.entries()) {
        const base = {
          sessionId: session.id,
          sessionBlockId: sessionBlock.id,
          exerciseId: item.exerciseId,
          machineId: item.machineId,
          position: position++,
          restSec: item.restSec,
        };
        if (isWod(block.kind)) {
          const { reps, weight, durationSec, distanceM, calories } = item;
          await tx.insert(sessionSets).values({ ...createdFields(), ...base, setIndex: 0, reps, weight, durationSec, distanceM, calories });
          continue;
        }
        const paired = pairPrevious(item.sets, previous[blockPos][itemPos]);
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
    }
    return session.id;
  });
}

/** Starts a session with no routine ("Treino livre") and one empty exercises block. */
export async function startEmptySession(locationId: string | null = null): Promise<string> {
  const session = createdFields();
  await db.transaction(async (tx) => {
    await tx.insert(sessions).values({ ...session, workoutId: null, name: 'Treino livre', locationId, startedAt: Date.now() });
    await tx
      .insert(sessionBlocks)
      .values({ ...createdFields(), ...defaultBlockConfig('exercises'), sessionId: session.id, position: 0 });
  });
  return session.id;
}

/** Appends a block (exercises or a WOD with default settings) to an in-progress session. */
export async function addBlockToSession(sessionId: string, kind: BlockKind, config: Partial<BlockConfig> = {}) {
  const [{ maxPos }] = await db
    .select({ maxPos: max(sessionBlocks.position) })
    .from(sessionBlocks)
    .where(and(eq(sessionBlocks.sessionId, sessionId), isNull(sessionBlocks.deletedAt)));
  const row = {
    ...createdFields(),
    ...configOf({ ...defaultBlockConfig(kind), ...config, kind }),
    sessionId,
    position: (maxPos ?? -1) + 1,
    resultRounds: kind === 'amrap' ? 0 : null,
    resultReps: kind === 'amrap' ? 0 : null,
  };
  await db.insert(sessionBlocks).values(row);
  return row.id;
}

/** Updates a session block's settings (e.g. a WOD added during a "Treino livre"). */
export async function updateSessionBlock(id: string, config: Partial<BlockConfig>) {
  await db.update(sessionBlocks).set({ ...config, ...touched() }).where(eq(sessionBlocks.id, id));
}

/** Removes a block and its sets from an in-progress session. */
export async function removeSessionBlock(id: string) {
  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.update(sessionBlocks).set({ deletedAt: now, ...touched() }).where(eq(sessionBlocks.id, id));
    await tx
      .update(sessionSets)
      .set({ deletedAt: now, ...touched() })
      .where(and(eq(sessionSets.sessionBlockId, id), isNull(sessionSets.deletedAt)));
  });
}

/** Creates a routine from what was done in a session (e.g. after a "Treino livre"). */
export async function saveSessionAsRoutine(sessionId: string, name: string): Promise<string> {
  const blocks = await db.query.sessionBlocks.findMany({
    where: and(eq(sessionBlocks.sessionId, sessionId), isNull(sessionBlocks.deletedAt)),
    orderBy: asc(sessionBlocks.position),
  });
  const rows = await db.query.sessionSets.findMany({
    where: and(eq(sessionSets.sessionId, sessionId), isNull(sessionSets.deletedAt)),
    orderBy: [asc(sessionSets.position), asc(sessionSets.setIndex)],
  });
  const pairs = blocks.map((b) => {
    const byPosition = new Map<number, WorkoutItemDraft>();
    for (const r of rows.filter((x) => x.sessionBlockId === b.id)) {
      let item = byPosition.get(r.position);
      const { reps, weight, durationSec, distanceM, calories } = r;
      if (!item) {
        item = {
          exerciseId: r.exerciseId,
          machineId: r.machineId,
          sets: [],
          // WOD movements keep their per-round amounts on the item.
          ...(isWod(b.kind) ? { reps, weight, durationSec, distanceM, calories } : emptyAmounts),
          restSec: r.restSec,
          notes: null,
        };
        byPosition.set(r.position, item);
      }
      if (!isWod(b.kind)) item.sets.push(newSet(r.type, { reps, weight, durationSec, distanceM, calories }));
    }
    const draft: BlockDraft = { ...emptyBlock(b.kind), ...configOf(b), notes: b.notes, items: [...byPosition.values()] };
    return { block: b, draft };
  });
  const kept = pairs.filter((p) => p.draft.items.length);
  const id = await saveWorkout(null, { name, notes: null, locationId: null, blocks: kept.map((p) => p.draft) });

  // The session now counts as a run of the new routine (rotation, history, WOD PRs).
  const created = await db.query.workoutBlocks.findMany({
    where: and(eq(workoutBlocks.workoutId, id), isNull(workoutBlocks.deletedAt)),
    orderBy: asc(workoutBlocks.position),
  });
  await db.transaction(async (tx) => {
    await tx.update(sessions).set({ workoutId: id, name, ...touched() }).where(eq(sessions.id, sessionId));
    for (const [i, { block }] of kept.entries()) {
      if (created[i]) {
        await tx.update(sessionBlocks).set({ workoutBlockId: created[i].id, ...touched() }).where(eq(sessionBlocks.id, block.id));
      }
    }
  });
  return id;
}

const emptyAmounts = { reps: null, weight: null, durationSec: null, distanceM: null, calories: null };

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
    // Same block as the exercise's other sets: the session screen lists sets per block.
    sessionBlockId: last.sessionBlockId,
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

/** Appends a new exercise to a block of an in-progress session. */
export async function addExerciseToSession(sessionId: string, sessionBlockId: string, exerciseId: string) {
  const block = await db.query.sessionBlocks.findFirst({ where: eq(sessionBlocks.id, sessionBlockId) });
  const [{ maxPos }] = await db
    .select({ maxPos: max(sessionSets.position) })
    .from(sessionSets)
    .where(eq(sessionSets.sessionId, sessionId));
  const wod = block ? isWod(block.kind) : false;
  await db.insert(sessionSets).values({
    ...createdFields(),
    sessionId,
    sessionBlockId,
    exerciseId,
    position: (maxPos ?? -1) + 1,
    setIndex: 0,
    reps: 10,
    weight: wod
      ? null
      : ((await previousSessionSets(exerciseId, null)).find((p) => countsTowardStats(p.type))?.weight ?? 0),
    restSec: wod ? null : 90,
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

/** AMRAP round counter, saved on every tap. */
export async function updateWodProgress(
  sessionBlockId: string,
  values: { resultRounds?: number; resultReps?: number; roundSplits?: number[]; roundReps?: number[] },
) {
  await db.update(sessionBlocks).set({ ...values, ...touched() }).where(eq(sessionBlocks.id, sessionBlockId));
}

export type BlockResult = {
  resultTimeSec?: number | null;
  resultRounds?: number | null;
  resultReps?: number | null;
  /** Tabata: reps of each round, as reviewed on the result screen. */
  roundReps?: number[] | null;
  rx?: boolean;
};

/** Clears a WOD block's result and round progress (recorded by mistake) so it can be done again. */
export async function resetBlock(sessionBlockId: string) {
  await db.transaction(async (tx) => {
    const b = await tx.query.sessionBlocks.findFirst({ where: eq(sessionBlocks.id, sessionBlockId) });
    if (!b) return;
    await tx
      .update(sessionBlocks)
      .set({
        finishedAt: null,
        resultTimeSec: null,
        resultRounds: b.kind === 'amrap' ? 0 : null,
        resultReps: b.kind === 'amrap' ? 0 : null,
        roundSplits: null,
        roundReps: null,
        rx: true,
        isPr: false,
        ...touched(),
      })
      .where(eq(sessionBlocks.id, sessionBlockId));
    await tx
      .update(sessionSets)
      .set({ completedAt: null, ...touched() })
      .where(and(eq(sessionSets.sessionBlockId, sessionBlockId), isNull(sessionSets.deletedAt)));
  });
}

/** Saves a WOD block's result: its movements count as done, and it may be a PR for the routine block. */
export async function finishBlock(sessionBlockId: string, result: BlockResult) {
  const finishedAt = Date.now();
  await db.transaction(async (tx) => {
    await tx
      .update(sessionBlocks)
      .set({ ...result, finishedAt, ...touched() })
      .where(eq(sessionBlocks.id, sessionBlockId));
    await tx
      .update(sessionSets)
      .set({ completedAt: finishedAt, ...touched() })
      .where(and(eq(sessionSets.sessionBlockId, sessionBlockId), isNull(sessionSets.completedAt)));
    const b = await tx.query.sessionBlocks.findFirst({ where: eq(sessionBlocks.id, sessionBlockId) });
    if (!b || !isWod(b.kind) || !b.workoutBlockId) return;
    const previous = await tx
      .select({ block: sessionBlocks })
      .from(sessionBlocks)
      .innerJoin(sessions, eq(sessions.id, sessionBlocks.sessionId))
      .where(
        and(
          eq(sessionBlocks.workoutBlockId, b.workoutBlockId),
          ne(sessionBlocks.id, b.id),
          isNotNull(sessionBlocks.finishedAt),
          isNull(sessionBlocks.deletedAt),
          isNull(sessions.deletedAt),
        ),
      );
    const isPr = isWodPR(b.kind, b, previous.map((r) => r.block));
    await tx.update(sessionBlocks).set({ isPr, ...touched() }).where(eq(sessionBlocks.id, b.id));
  });
}

export type SessionResult = {
  /** Adjusted start/end times (ms); default: keep the start, end now. */
  startedAt?: number;
  finishedAt?: number;
  notes?: string | null;
};

export async function finishSession(id: string, { finishedAt = Date.now(), ...result }: SessionResult = {}) {
  await db.update(sessions).set({ ...result, finishedAt, ...touched() }).where(eq(sessions.id, id));
}

export async function deleteSession(id: string) {
  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.update(sessions).set({ deletedAt: now, ...touched() }).where(eq(sessions.id, id));
    await tx
      .update(sessionBlocks)
      .set({ deletedAt: now, ...touched() })
      .where(and(eq(sessionBlocks.sessionId, id), isNull(sessionBlocks.deletedAt)));
    await tx
      .update(sessionSets)
      .set({ deletedAt: now, ...touched() })
      .where(and(eq(sessionSets.sessionId, id), isNull(sessionSets.deletedAt)));
  });
}

/**
 * "Atualizar rotina com estes valores": the routine's targets become what was done in this session.
 * Exercises blocks: each routine item takes the completed sets (type, reps, load, machine) of the same exercise
 * in the matching session block; WOD blocks: each movement takes its reps and load. Items not done, and exercises
 * added during the session, are left as they are. Returns how many items changed.
 */
export async function updateRoutineFromSession(sessionId: string): Promise<number> {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session?.workoutId) return 0;
  const draft = await getWorkoutDraft(session.workoutId);
  if (!draft) return 0;
  const sBlocks = await db
    .select()
    .from(sessionBlocks)
    .where(and(eq(sessionBlocks.sessionId, sessionId), isNull(sessionBlocks.deletedAt)));
  const sets = await db
    .select()
    .from(sessionSets)
    .where(and(eq(sessionSets.sessionId, sessionId), isNull(sessionSets.deletedAt)))
    .orderBy(asc(sessionSets.position), asc(sessionSets.setIndex));

  let changed = 0;
  for (const block of draft.blocks) {
    const sb = sBlocks.find((b) => b.workoutBlockId && b.workoutBlockId === block.id);
    if (!sb) continue;
    // One group per exercise of the session block, in order.
    const groups = new Map<number, SessionSet[]>();
    for (const s of sets) if (s.sessionBlockId === sb.id) groups.set(s.position, [...(groups.get(s.position) ?? []), s]);
    const unused = [...groups.values()];

    for (const item of block.items) {
      const i = unused.findIndex((g) => g[0].exerciseId === item.exerciseId);
      if (i < 0) continue;
      const [group] = unused.splice(i, 1);
      if (block.kind === 'exercises') {
        const done = group.filter((s) => s.completedAt);
        if (!done.length) continue;
        item.sets = done.map((s, j) => ({
          id: item.sets[j]?.id,
          type: s.type,
          reps: s.reps,
          weight: s.weight ?? 0,
          durationSec: s.durationSec,
          distanceM: s.distanceM,
          calories: s.calories,
        }));
        item.machineId = done[0].machineId ?? item.machineId;
      } else {
        const m = group[0];
        item.reps = m.reps;
        item.weight = m.weight;
        item.durationSec = m.durationSec;
        item.distanceM = m.distanceM;
        item.calories = m.calories;
      }
      changed++;
    }
  }
  if (changed) await saveWorkout(session.workoutId, draft);
  return changed;
}
