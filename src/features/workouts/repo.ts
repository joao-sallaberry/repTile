import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  exercises,
  workoutBlocks,
  workoutItems,
  workoutItemSets,
  workouts,
  type BlockKind,
  type Equipment,
  type Measure,
  type SetType,
} from '@/db/schema';
import { createdFields, touched } from '@/lib/ids';

import { cleanBlockConfig, defaultBlockConfig, type BlockConfig } from './blocks';

/** Exercises blocks: the target of one set. */
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
  /** Exercises blocks: one entry per set (weight and reps may vary). Empty in WOD blocks. */
  sets: SetDraft[];
  /** WOD blocks: reps/weight/etc. per round (or per interval). */
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
  distanceM: number | null;
  calories: number | null;
  restSec: number | null;
  notes: string | null;
};

export type BlockDraft = BlockConfig & {
  id?: string;
  notes: string | null;
  items: WorkoutItemDraft[];
};

export type WorkoutDraft = {
  name: string;
  notes: string | null;
  locationId: string | null;
  blocks: BlockDraft[];
};

export const newSet = (type: SetType = 'normal', from?: Partial<SetDraft>): SetDraft => ({
  type,
  reps: from?.reps ?? 10,
  weight: from?.weight ?? 0,
  durationSec: from?.durationSec ?? null,
  distanceM: from?.distanceM ?? null,
  calories: from?.calories ?? null,
});

export const emptyItem = (exerciseId: string, kind: BlockKind): WorkoutItemDraft => ({
  exerciseId,
  machineId: null,
  sets: kind === 'exercises' ? [newSet(), newSet(), newSet()] : [],
  reps: 10,
  weight: null,
  durationSec: null,
  distanceM: null,
  calories: null,
  restSec: kind === 'exercises' ? 90 : null,
  notes: null,
});

export const emptyBlock = (kind: BlockKind): BlockDraft => ({ ...defaultBlockConfig(kind), notes: null, items: [] });

export function emptyWorkout(): WorkoutDraft {
  return { name: '', notes: null, locationId: null, blocks: [] };
}

export async function getWorkoutDraft(id: string): Promise<WorkoutDraft | null> {
  const w = await db.query.workouts.findFirst({
    where: and(eq(workouts.id, id), isNull(workouts.deletedAt)),
    with: {
      blocks: {
        where: isNull(workoutBlocks.deletedAt),
        orderBy: asc(workoutBlocks.position),
        with: {
          items: {
            where: isNull(workoutItems.deletedAt),
            orderBy: asc(workoutItems.position),
            with: { targetSets: { where: isNull(workoutItemSets.deletedAt), orderBy: asc(workoutItemSets.position) } },
          },
        },
      },
    },
  });
  if (!w) return null;
  return {
    name: w.name,
    notes: w.notes,
    locationId: w.locationId,
    blocks: w.blocks.map((b) => ({
      id: b.id,
      kind: b.kind,
      durationSec: b.durationSec,
      intervalSec: b.intervalSec,
      rounds: b.rounds,
      timeCapSec: b.timeCapSec,
      workSec: b.workSec,
      restSec: b.restSec,
      alternate: b.alternate,
      notes: b.notes,
      items: b.items.map((i) => ({
        id: i.id,
        exerciseId: i.exerciseId,
        machineId: i.machineId,
        sets:
          b.kind !== 'exercises'
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
    })),
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Soft-deletes rows of `table` with the given ids. */
async function softDelete(tx: Tx, table: typeof workoutBlocks | typeof workoutItems | typeof workoutItemSets, ids: string[]) {
  if (ids.length) await tx.update(table).set({ deletedAt: Date.now(), ...touched() }).where(inArray(table.id, ids));
}

/** Creates or updates a workout, replacing its blocks and their items. Returns the ID. */
export async function saveWorkout(id: string | null, draft: WorkoutDraft): Promise<string> {
  const { blocks, ...fields } = draft;
  return db.transaction(async (tx) => {
    let workoutId = id;
    if (workoutId) {
      await tx.update(workouts).set({ ...fields, ...touched() }).where(eq(workouts.id, workoutId));
    } else {
      const created = createdFields();
      workoutId = created.id;
      await tx.insert(workouts).values({ ...created, ...fields });
    }

    const keepBlocks = new Set(blocks.flatMap((b) => (b.id ? [b.id] : [])));
    const keepItems = new Set(blocks.flatMap((b) => b.items.flatMap((i) => (i.id ? [i.id] : []))));
    const oldBlocks = await tx
      .select({ id: workoutBlocks.id })
      .from(workoutBlocks)
      .where(and(eq(workoutBlocks.workoutId, workoutId), isNull(workoutBlocks.deletedAt)));
    await softDelete(tx, workoutBlocks, oldBlocks.map((b) => b.id).filter((bid) => !keepBlocks.has(bid)));
    const oldItems = await tx
      .select({ id: workoutItems.id })
      .from(workoutItems)
      .where(and(eq(workoutItems.workoutId, workoutId), isNull(workoutItems.deletedAt)));
    await softDelete(tx, workoutItems, oldItems.map((i) => i.id).filter((iid) => !keepItems.has(iid)));

    for (const [blockPos, { id: existingBlockId, items, ...block }] of blocks.entries()) {
      const blockValues = { ...cleanBlockConfig(block), notes: block.notes, position: blockPos };
      let blockId = existingBlockId;
      if (blockId) {
        await tx.update(workoutBlocks).set({ ...blockValues, ...touched() }).where(eq(workoutBlocks.id, blockId));
      } else {
        const created = createdFields();
        blockId = created.id;
        await tx.insert(workoutBlocks).values({ ...created, ...blockValues, workoutId });
      }

      for (const [position, { id: existingId, sets, ...item }] of items.entries()) {
        const plain = block.kind === 'exercises';
        const values = { ...item, blockId, position, sets: plain ? sets.length : null, restSec: plain ? item.restSec : null };
        let itemId = existingId;
        if (itemId) {
          await tx.update(workoutItems).set({ ...values, ...touched() }).where(eq(workoutItems.id, itemId));
        } else {
          const created = createdFields();
          itemId = created.id;
          await tx.insert(workoutItems).values({ ...created, ...values, workoutId });
        }

        // Sync the per-set targets: update kept rows, insert new ones, soft-delete the rest.
        const targets = plain ? sets : [];
        const oldSets = await tx
          .select({ id: workoutItemSets.id })
          .from(workoutItemSets)
          .where(and(eq(workoutItemSets.workoutItemId, itemId), isNull(workoutItemSets.deletedAt)));
        const keepSets = new Set(targets.flatMap((st) => (st.id ? [st.id] : [])));
        await softDelete(tx, workoutItemSets, oldSets.map((o) => o.id).filter((sid) => !keepSets.has(sid)));
        for (const [setPos, { id: setId, ...target }] of targets.entries()) {
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
    }
    return workoutId;
  });
}

/** A draft without database ids, to save as a new workout. */
export function stripIds(draft: WorkoutDraft): WorkoutDraft {
  return {
    ...draft,
    blocks: draft.blocks.map(({ id: _bid, items, ...b }) => ({
      ...b,
      items: items.map(({ id: _id, sets, ...i }) => ({ ...i, sets: sets.map(({ id: _sid, ...st }) => st) })),
    })),
  };
}

export async function duplicateWorkout(id: string): Promise<string | null> {
  const draft = await getWorkoutDraft(id);
  if (!draft) return null;
  return saveWorkout(null, { ...stripIds(draft), name: `${draft.name} (cópia)` });
}

export async function deleteWorkout(id: string) {
  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.update(workouts).set({ deletedAt: now, ...touched() }).where(eq(workouts.id, id));
    for (const t of [workoutBlocks, workoutItems]) {
      await tx
        .update(t)
        .set({ deletedAt: now, ...touched() })
        .where(and(eq(t.workoutId, id), isNull(t.deletedAt)));
    }
  });
}

export async function createExercise(input: { name: string; category: string; measure: Measure; equipment: Equipment }) {
  const row = { ...createdFields(), ...input, isCustom: true };
  await db.insert(exercises).values(row);
  return row.id;
}

export async function updateExercise(id: string, patch: { equipment: Equipment }) {
  await db.update(exercises).set({ ...patch, ...touched() }).where(eq(exercises.id, id));
}

export async function deleteExercise(id: string) {
  await db.update(exercises).set({ deletedAt: Date.now(), ...touched() }).where(eq(exercises.id, id));
}

