import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, max, ne, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  exercises,
  sessionBlocks,
  sessions,
  sessionSets,
  workoutBlocks,
  type BlockKind,
  type Equipment,
  type SessionSet,
  type SetType,
} from '@/db/schema';
import { linkMachineToExercise, linkMachineToLocation } from '@/features/places/repo';
import { isNewPR, isWodPR, type PerformedSet } from '@/features/stats/prs';
import { cleanBlockConfig, defaultBlockConfig, isWod, type BlockConfig } from '@/features/workouts/blocks';
import { defaultEquipment, hasStation } from '@/features/workouts/equipment';
import {
  defaultEquipmentOf,
  emptyBlock,
  getWorkoutDraft,
  newSet,
  saveWorkout,
  type BlockDraft,
  type WorkoutItemDraft,
} from '@/features/workouts/repo';
import { blocksOf, pickVariant, variantKeys, variantLocation, type VariantKey } from '@/features/workouts/variants';
import { createdFields, touched } from '@/lib/ids';

import {
  routineUpdateChanges,
  updateRoutineBlocks,
  type RoutineUpdateOptions,
  type SessionBlockInput,
} from './routine-update';
import { countsTowardStats, pairPrevious } from './sets';

export type PerformedSetRow = PerformedSet & {
  type: SetType;
  equipment: Equipment | null;
  machineId: string | null;
  setIndex: number;
  /** The set was flagged as a record when it was completed (ADR 0009). */
  isPr: boolean;
  /** Name of the session it belongs to. */
  sessionName: string;
};

/**
 * Completed sets of an exercise in exercises blocks (not WODs), oldest first.
 * `equipment`: `undefined` = any equipment.
 * `machineId`: `undefined` = any machine; `null` = only sets done without a machine.
 */
export async function performedSets(
  exerciseId: string,
  opts: { equipment?: Equipment; machineId?: string | null; excludeSessionId?: string } = {},
): Promise<PerformedSetRow[]> {
  const rows = await db
    .select({
      sessionId: sessionSets.sessionId,
      completedAt: sessionSets.completedAt,
      weight: sessionSets.weight,
      reps: sessionSets.reps,
      type: sessionSets.type,
      equipment: sessionSets.equipment,
      machineId: sessionSets.machineId,
      setIndex: sessionSets.setIndex,
      isPr: sessionSets.isPr,
      sessionName: sessions.name,
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
        opts.equipment === undefined ? undefined : eq(sessionSets.equipment, opts.equipment),
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

/** Sets of the most recent other session with this exercise, equipment and machine, in set order. */
export async function previousSessionSets(
  exerciseId: string,
  equipment: Equipment,
  machineId: string | null,
  excludeSessionId?: string,
): Promise<PerformedSetRow[]> {
  const all = await performedSets(exerciseId, { equipment, machineId, excludeSessionId });
  const last = all.at(-1);
  if (!last) return [];
  return all.filter((r) => r.sessionId === last.sessionId).sort((a, b) => a.setIndex - b.setIndex);
}

const configOf = (b: BlockConfig): BlockConfig => {
  const { kind, durationSec, intervalSec, rounds, timeCapSec, workSec, restSec, alternate } = cleanBlockConfig(b);
  return { kind, durationSec, intervalSec, rounds, timeCapSec, workSec, restSec, alternate };
};

/**
 * Starts a routine. `variant` picks its location variant (ADR 0020); when omitted, the one of the current location
 * (`pickVariant`). The session takes place at the variant's location, else the routine's, else the current one.
 */
export async function startSession(
  workoutId: string,
  currentLocationId: string | null = null,
  variant?: VariantKey,
): Promise<string> {
  const routine = await getWorkoutDraft(workoutId);
  if (!routine) throw new Error('Treino não encontrado');
  const picked =
    variant === undefined
      ? pickVariant(variantKeys(routine.blocks), routine.locationId, currentLocationId)
      : { variant, locationId: variantLocation(variant, routine.locationId) ?? currentLocationId };
  const w = { ...routine, blocks: blocksOf(routine.blocks, picked.variant) };
  const defaults = await defaultEquipmentOf(w.blocks.flatMap((b) => b.items.map((i) => i.exerciseId)));
  const equipmentOf = (item: WorkoutItemDraft) => item.equipment ?? defaults.get(item.exerciseId) ?? 'none';

  // Pre-fill each set from the routine target, else from the same set last time with the same equipment and machine.
  const previous = await Promise.all(
    w.blocks.map((b) =>
      Promise.all(
        b.items.map((item) =>
          b.kind === 'exercises' ? previousSessionSets(item.exerciseId, equipmentOf(item), item.machineId) : Promise.resolve([]),
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
      locationId: picked.locationId,
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
          equipment: equipmentOf(item),
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
          equipment: r.equipment,
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

/** Whether a completed set beats the earlier sessions on the same exercise, equipment and machine. */
async function isSetPr(set: SessionSet, completedAt: number): Promise<boolean> {
  if (!countsTowardStats(set.type)) return false;
  const previous = await performedSets(set.exerciseId, {
    equipment: set.equipment ?? undefined,
    machineId: set.machineId,
    excludeSessionId: set.sessionId,
  });
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

/** Marks the set as done. Returns `true` if it is a new personal record (same equipment and machine, warm-ups excluded). */
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

/**
 * Sets the equipment for every set of an exercise in the session (one of the exercise's).
 * The machine is cleared when the new equipment has no station.
 */
export async function setExerciseEquipment(sessionId: string, position: number, equipment: Equipment) {
  await db
    .update(sessionSets)
    .set({ equipment, ...(hasStation(equipment) ? {} : { machineId: null }), ...touched() })
    .where(and(eq(sessionSets.sessionId, sessionId), eq(sessionSets.position, position), isNull(sessionSets.deletedAt)));
}

/** Rest between sets for one exercise of the session (every set at that position). */
export async function setExerciseRest(sessionId: string, position: number, restSec: number | null) {
  await db
    .update(sessionSets)
    .set({ restSec, ...touched() })
    .where(and(eq(sessionSets.sessionId, sessionId), eq(sessionSets.position, position), isNull(sessionSets.deletedAt)));
}

/** Same rest between sets for every exercise of the session's exercises blocks (WOD movements have none). */
export async function setSessionRest(sessionId: string, restSec: number | null) {
  const blocks = db
    .select({ id: sessionBlocks.id })
    .from(sessionBlocks)
    .where(and(eq(sessionBlocks.sessionId, sessionId), eq(sessionBlocks.kind, 'exercises'), isNull(sessionBlocks.deletedAt)));
  await db
    .update(sessionSets)
    .set({ restSec, ...touched() })
    .where(and(eq(sessionSets.sessionId, sessionId), inArray(sessionSets.sessionBlockId, blocks), isNull(sessionSets.deletedAt)));
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
    equipment: last.equipment,
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
  // Same equipment as last time, else the exercise's default.
  const exercise = await db.query.exercises.findFirst({ where: eq(exercises.id, exerciseId) });
  const lastUsed = (await performedSets(exerciseId)).at(-1)?.equipment;
  const equipment = lastUsed && exercise?.equipment.includes(lastUsed) ? lastUsed : defaultEquipment(exercise);
  await db.insert(sessionSets).values({
    ...createdFields(),
    sessionId,
    sessionBlockId,
    exerciseId,
    equipment,
    position: (maxPos ?? -1) + 1,
    setIndex: 0,
    reps: 10,
    weight: wod
      ? null
      : ((await previousSessionSets(exerciseId, equipment, null)).find((p) => countsTowardStats(p.type))?.weight ?? 0),
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

/**
 * Applies the order picked in "Reordenar": the blocks in `order`, each listing its exercises by
 * their current `position`. Positions are renumbered across the session in that order.
 */
export async function reorderSession(sessionId: string, order: { blockId: string; positions: number[] }[]) {
  const moves = order.flatMap((b) => b.positions).map((from, to) => [from, to] as const);
  await db.transaction(async (tx) => {
    for (const [i, b] of order.entries()) {
      await tx.update(sessionBlocks).set({ position: i, ...touched() }).where(eq(sessionBlocks.id, b.blockId));
    }
    // Through negative numbers first, so two exercises never share a position midway.
    for (const [from, to] of moves) {
      await tx
        .update(sessionSets)
        .set({ position: -1 - to, ...touched() })
        .where(and(eq(sessionSets.sessionId, sessionId), eq(sessionSets.position, from)));
    }
    await tx
      .update(sessionSets)
      .set({ position: sql`-1 - ${sessionSets.position}` })
      .where(and(eq(sessionSets.sessionId, sessionId), lt(sessionSets.position, 0)));
  });
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
  /** The name shown in history; defaults to the routine's name when the session starts. */
  name?: string;
  notes?: string | null;
};

export async function finishSession(id: string, { finishedAt = Date.now(), ...result }: SessionResult = {}) {
  await db.update(sessions).set({ ...result, finishedAt, ...touched() }).where(eq(sessions.id, id));
}

/** Changes when a finished session started and ended (Histórico › Editar data e horários). */
export async function setSessionTimes(id: string, startedAt: number, finishedAt: number) {
  await db.update(sessions).set({ startedAt, finishedAt, ...touched() }).where(eq(sessions.id, id));
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
 * The routine variant a finished session ran, and the session's blocks and exercises in order, for
 * "Atualizar rotina" (`routine-update.ts`). `null` for a "Treino livre" or a deleted routine.
 */
async function routineUpdateInput(sessionId: string) {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session?.workoutId) return null;
  const draft = await getWorkoutDraft(session.workoutId);
  if (!draft) return null;
  const sBlocks = await db
    .select()
    .from(sessionBlocks)
    .where(and(eq(sessionBlocks.sessionId, sessionId), isNull(sessionBlocks.deletedAt)))
    .orderBy(asc(sessionBlocks.position));
  const sets = await db
    .select()
    .from(sessionSets)
    .where(and(eq(sessionSets.sessionId, sessionId), isNull(sessionSets.deletedAt)))
    .orderBy(asc(sessionSets.position), asc(sessionSets.setIndex));

  const blocks: SessionBlockInput[] = sBlocks.map((sb) => {
    // One exercise per position, in order.
    const groups = new Map<number, SessionSet[]>();
    for (const s of sets) if (s.sessionBlockId === sb.id) groups.set(s.position, [...(groups.get(s.position) ?? []), s]);
    return {
      ...configOf(sb),
      workoutBlockId: sb.workoutBlockId,
      exercises: [...groups.values()].map((g) => ({ exerciseId: g[0].exerciseId, sets: g })),
    };
  });
  // The variant run: the one of the routine blocks the session came from, else the one the location would pick.
  const ran = draft.blocks.find((b) => b.id && sBlocks.some((sb) => sb.workoutBlockId === b.id));
  const variant = ran
    ? ran.locationId
    : pickVariant(variantKeys(draft.blocks), draft.locationId, session.locationId).variant;
  return { workoutId: session.workoutId, draft, variant, routine: blocksOf(draft.blocks, variant), blocks };
}

/** Which parts of "Atualizar rotina" would change the routine; `null` when the session has no routine. */
export async function routineUpdateOptions(sessionId: string): Promise<RoutineUpdateOptions | null> {
  const input = await routineUpdateInput(sessionId);
  return input && routineUpdateChanges(input.routine, input.blocks, input.variant);
}

/**
 * "Atualizar rotina": the routine variant the session ran takes its exercises and order and/or its sets, loads
 * and rest (`updateRoutineBlocks`). Other variants are untouched. Returns whether anything changed.
 */
export async function updateRoutineFromSession(sessionId: string, options: RoutineUpdateOptions): Promise<boolean> {
  const input = await routineUpdateInput(sessionId);
  if (!input) return false;
  const { workoutId, draft, variant, routine, blocks } = input;
  const changes = routineUpdateChanges(routine, blocks, variant);
  if (!(options.structure && changes.structure) && !(options.values && changes.values)) return false;
  const updated = updateRoutineBlocks(routine, blocks, options, variant);
  // Keep the variants in their order: this one's blocks where its first block was.
  const at = draft.blocks.findIndex((b) => (b.locationId ?? null) === variant);
  const others = draft.blocks.filter((b) => (b.locationId ?? null) !== variant);
  const insertAt = at < 0 ? others.length : draft.blocks.slice(0, at).filter((b) => (b.locationId ?? null) !== variant).length;
  await saveWorkout(workoutId, { ...draft, blocks: [...others.slice(0, insertAt), ...updated, ...others.slice(insertAt)] });
  return true;
}
