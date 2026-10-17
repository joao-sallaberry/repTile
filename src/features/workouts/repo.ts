import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  exercises,
  workoutItems,
  workoutItemSets,
  workouts,
  type Measure,
  type SetType,
  type WorkoutType,
} from '@/db/schema';
import { createdFields, touched } from '@/lib/ids';

/** Strength: the target of one set. */
export type SetDraft = {
  id?: string;
  type: SetType;
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
  distanceM: number | null;
  calories: number | null;
};

export type WorkoutItemDraft = {
  /** Present when the item already exists in the database. */
  id?: string;
  exerciseId: string;
  machineId: string | null;
  /** Strength: one entry per set (weight and reps may vary). Empty for WODs. */
  sets: SetDraft[];
  /** WODs: reps/weight/etc. per round. */
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
  distanceM: number | null;
  calories: number | null;
  restSec: number | null;
  notes: string | null;
};

export type WorkoutDraft = {
  name: string;
  type: WorkoutType;
  notes: string | null;
  durationSec: number | null;
  intervalSec: number | null;
  rounds: number | null;
  timeCapSec: number | null;
  locationId: string | null;
  items: WorkoutItemDraft[];
};

export const newSet = (type: SetType = 'normal', from?: Partial<SetDraft>): SetDraft => ({
  type,
  reps: from?.reps ?? 10,
  weight: from?.weight ?? 0,
  durationSec: from?.durationSec ?? null,
  distanceM: from?.distanceM ?? null,
  calories: from?.calories ?? null,
});

export const emptyItem = (exerciseId: string, type: WorkoutType): WorkoutItemDraft => ({
  exerciseId,
  machineId: null,
  sets: type === 'strength' ? [newSet(), newSet(), newSet()] : [],
  reps: 10,
  weight: null,
  durationSec: null,
  distanceM: null,
  calories: null,
  restSec: type === 'strength' ? 90 : null,
  notes: null,
});

export function emptyWorkout(type: WorkoutType = 'strength'): WorkoutDraft {
  return {
    name: '',
    type,
    notes: null,
    durationSec: type === 'amrap' ? 12 * 60 : null,
    intervalSec: type === 'emom' ? 60 : null,
    rounds: type === 'emom' ? 10 : type === 'for_time' ? 3 : null,
    timeCapSec: type === 'for_time' ? 15 * 60 : null,
    locationId: null,
    items: [],
  };
}

export async function getWorkoutDraft(id: string): Promise<WorkoutDraft | null> {
  const w = await db.query.workouts.findFirst({
    where: and(eq(workouts.id, id), isNull(workouts.deletedAt)),
    with: {
      items: {
        where: isNull(workoutItems.deletedAt),
        orderBy: asc(workoutItems.position),
        with: { targetSets: { where: isNull(workoutItemSets.deletedAt), orderBy: asc(workoutItemSets.position) } },
      },
    },
  });
  if (!w) return null;
  return {
    name: w.name,
    type: w.type,
    notes: w.notes,
    durationSec: w.durationSec,
    intervalSec: w.intervalSec,
    rounds: w.rounds,
    timeCapSec: w.timeCapSec,
    locationId: w.locationId,
    items: w.items.map((i) => ({
      id: i.id,
      exerciseId: i.exerciseId,
      machineId: i.machineId,
      sets:
        w.type !== 'strength'
          ? []
          : i.targetSets.length
            ? i.targetSets.map((t) => ({
                id: t.id,
                type: t.type,
                reps: t.reps,
                weight: t.weight,
                durationSec: t.durationSec,
                distanceM: t.distanceM,
                calories: t.calories,
              }))
            : Array.from({ length: Math.max(1, i.sets ?? 1) }, () => newSet('normal', i)),
      reps: i.reps,
      weight: i.weight,
      durationSec: i.durationSec,
      distanceM: i.distanceM,
      calories: i.calories,
      restSec: i.restSec,
      notes: i.notes,
    })),
  };
}

/** Creates or updates a workout, replacing its exercise list. Returns the ID. */
export async function saveWorkout(id: string | null, draft: WorkoutDraft): Promise<string> {
  const { items, ...fields } = draft;
  return db.transaction(async (tx) => {
    let workoutId = id;
    if (workoutId) {
      await tx.update(workouts).set({ ...fields, ...touched() }).where(eq(workouts.id, workoutId));
    } else {
      const created = createdFields();
      workoutId = created.id;
      await tx.insert(workouts).values({ ...created, ...fields });
    }

    const existing = await tx
      .select({ id: workoutItems.id })
      .from(workoutItems)
      .where(and(eq(workoutItems.workoutId, workoutId), isNull(workoutItems.deletedAt)));
    const keep = new Set(items.flatMap((i) => (i.id ? [i.id] : [])));
    const removed = existing.map((e) => e.id).filter((eid) => !keep.has(eid));
    if (removed.length) {
      await tx
        .update(workoutItems)
        .set({ deletedAt: Date.now(), ...touched() })
        .where(inArray(workoutItems.id, removed));
    }

    for (const [position, { id: existingId, sets, ...item }] of items.entries()) {
      const values = { ...item, position, sets: fields.type === 'strength' ? sets.length : null };
      let itemId = existingId;
      if (itemId) {
        await tx.update(workoutItems).set({ ...values, ...touched() }).where(eq(workoutItems.id, itemId));
      } else {
        const created = createdFields();
        itemId = created.id;
        await tx.insert(workoutItems).values({ ...created, ...values, workoutId });
      }

      // Sync the per-set targets: update kept rows, insert new ones, soft-delete the rest.
      const oldSets = await tx
        .select({ id: workoutItemSets.id })
        .from(workoutItemSets)
        .where(and(eq(workoutItemSets.workoutItemId, itemId), isNull(workoutItemSets.deletedAt)));
      const keepSets = new Set(sets.flatMap((st) => (st.id ? [st.id] : [])));
      const removedSets = oldSets.map((o) => o.id).filter((sid) => !keepSets.has(sid));
      if (removedSets.length) {
        await tx
          .update(workoutItemSets)
          .set({ deletedAt: Date.now(), ...touched() })
          .where(inArray(workoutItemSets.id, removedSets));
      }
      for (const [setPos, { id: setId, ...target }] of sets.entries()) {
        if (setId) {
          await tx
            .update(workoutItemSets)
            .set({ ...target, position: setPos, ...touched() })
            .where(eq(workoutItemSets.id, setId));
        } else {
          await tx
            .insert(workoutItemSets)
            .values({ ...createdFields(), ...target, workoutItemId: itemId, position: setPos });
        }
      }
    }
    return workoutId;
  });
}

export async function duplicateWorkout(id: string): Promise<string | null> {
  const draft = await getWorkoutDraft(id);
  if (!draft) return null;
  return saveWorkout(null, {
    ...draft,
    name: `${draft.name} (cópia)`,
    items: draft.items.map(({ id: _id, sets, ...i }) => ({ ...i, sets: sets.map(({ id: _sid, ...st }) => st) })),
  });
}

export async function deleteWorkout(id: string) {
  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.update(workouts).set({ deletedAt: now, ...touched() }).where(eq(workouts.id, id));
    await tx
      .update(workoutItems)
      .set({ deletedAt: now, ...touched() })
      .where(and(eq(workoutItems.workoutId, id), isNull(workoutItems.deletedAt)));
  });
}

export async function createExercise(input: { name: string; category: string; measure: Measure }) {
  const row = { ...createdFields(), ...input, isCustom: true };
  await db.insert(exercises).values(row);
  return row.id;
}

export async function deleteExercise(id: string) {
  await db.update(exercises).set({ deletedAt: Date.now(), ...touched() }).where(eq(exercises.id, id));
}

