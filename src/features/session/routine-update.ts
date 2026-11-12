/**
 * "Atualizar rotina" after a session (issue #5): the routine variant that was run takes what was done, in two
 * independent parts the user picks from. Pure, tested.
 *
 * - `structure`: exercises and order. The variant's blocks and exercises become the session's, in the session's
 *   order: blocks and exercises added during the session are added, removed ones are removed. Kept items keep
 *   their targets (unless `values` is also picked); new ones take what was done.
 * - `values`: sets, loads and rest. Each routine item done in the session takes its completed sets (type, reps,
 *   load), equipment, machine and rest; WOD movements take their reps and load. Items not done stay as they are.
 */
import type { Equipment, SessionSet } from '@/db/schema';
import { cleanBlockConfig, type BlockConfig } from '@/features/workouts/blocks';
import type { BlockDraft, SetDraft, WorkoutItemDraft } from '@/features/workouts/repo';
import { hasStation } from '@/features/workouts/equipment';

export type RoutineUpdateOptions = { structure: boolean; values: boolean };

type SetInput = Pick<
  SessionSet,
  'type' | 'reps' | 'weight' | 'durationSec' | 'distanceM' | 'calories' | 'restSec' | 'machineId' | 'completedAt'
> & { equipment: Equipment | null };

/** One exercise of a session block: its sets in order. */
export type SessionExercise = { exerciseId: string; sets: SetInput[] };

/** A session block, in session order, with its exercises in order. */
export type SessionBlockInput = BlockConfig & { workoutBlockId: string | null; exercises: SessionExercise[] };

const configOf = (b: BlockConfig): BlockConfig => {
  const { kind, durationSec, intervalSec, rounds, timeCapSec, workSec, restSec, alternate } = cleanBlockConfig(b);
  return { kind, durationSec, intervalSec, rounds, timeCapSec, workSec, restSec, alternate };
};

const toSet = (s: SetInput, id?: string): SetDraft => ({
  ...(id ? { id } : {}),
  type: s.type,
  reps: s.reps,
  weight: s.weight ?? 0,
  durationSec: s.durationSec,
  distanceM: s.distanceM,
  calories: s.calories,
});

/** Copies what was done into an item (in place). False when nothing was done. */
function applyValues(item: WorkoutItemDraft, ex: SessionExercise, plain: boolean): boolean {
  if (plain) {
    const done = ex.sets.filter((s) => s.completedAt);
    if (!done.length) return false;
    item.sets = done.map((s, j) => toSet(s, item.sets[j]?.id));
    item.equipment = done[0].equipment ?? item.equipment;
    item.machineId = hasStation(item.equipment) ? (done[0].machineId ?? item.machineId) : null;
    item.restSec = ex.sets[0].restSec;
  } else {
    const m = ex.sets[0];
    if (!m) return false;
    item.reps = m.reps;
    item.weight = m.weight;
    item.durationSec = m.durationSec;
    item.distanceM = m.distanceM;
    item.calories = m.calories;
  }
  return true;
}

/** A routine item for an exercise added during the session: what was done (else what was planned). */
function newItem(ex: SessionExercise, plain: boolean): WorkoutItemDraft {
  const done = ex.sets.filter((s) => s.completedAt);
  const source = done.length ? done : ex.sets;
  const first = source[0];
  const equipment = first?.equipment ?? null;
  return {
    exerciseId: ex.exerciseId,
    equipment,
    machineId: equipment && hasStation(equipment) ? (first?.machineId ?? null) : null,
    sets: plain ? source.map((s) => toSet(s)) : [],
    reps: plain ? null : (first?.reps ?? null),
    weight: plain ? null : (first?.weight ?? null),
    durationSec: plain ? null : (first?.durationSec ?? null),
    distanceM: plain ? null : (first?.distanceM ?? null),
    calories: plain ? null : (first?.calories ?? null),
    restSec: plain ? (first?.restSec ?? null) : null,
    notes: null,
  };
}

const copyBlock = (b: BlockDraft): BlockDraft => ({
  ...b,
  items: b.items.map((i) => ({ ...i, sets: i.sets.map((s) => ({ ...s })) })),
});

/**
 * The variant's new blocks. `routine` = the blocks of the variant that was run (not modified), `session` = the
 * session's blocks in order, `locationId` = the variant (for blocks added during the session).
 */
export function updateRoutineBlocks(
  routine: BlockDraft[],
  session: SessionBlockInput[],
  options: RoutineUpdateOptions,
  locationId: string | null,
): BlockDraft[] {
  const blocks = routine.map(copyBlock);
  const byId = new Map(blocks.flatMap((b) => (b.id ? [[b.id, b] as const] : [])));

  // Pair each session exercise with a routine item of the same exercise (first unused one, in order).
  const pairs = new Map<SessionExercise, WorkoutItemDraft>();
  for (const sb of session) {
    const rb = sb.workoutBlockId ? byId.get(sb.workoutBlockId) : undefined;
    if (!rb) continue;
    const unused = [...rb.items];
    for (const ex of sb.exercises) {
      const i = unused.findIndex((it) => it.exerciseId === ex.exerciseId);
      if (i < 0) continue;
      pairs.set(ex, unused.splice(i, 1)[0]);
    }
  }

  if (options.values) {
    for (const sb of session) {
      for (const ex of sb.exercises) {
        const item = pairs.get(ex);
        if (item) applyValues(item, ex, sb.kind === 'exercises');
      }
    }
  }
  if (!options.structure) return blocks;

  return session.map((sb) => {
    const plain = sb.kind === 'exercises';
    const items = sb.exercises.map((ex) => pairs.get(ex) ?? newItem(ex, plain));
    const rb = sb.workoutBlockId ? byId.get(sb.workoutBlockId) : undefined;
    return rb ? { ...rb, items } : { ...configOf(sb), locationId, notes: null, items };
  });
}

/** What matters for the comparison: no ids of new rows, no notes. */
const shape = (blocks: BlockDraft[]) =>
  JSON.stringify(
    blocks.map((b) => ({
      id: b.id,
      ...configOf(b),
      items: b.items.map((i) => ({
        id: i.id,
        exerciseId: i.exerciseId,
        equipment: i.equipment,
        machineId: i.machineId,
        restSec: i.restSec,
        reps: i.reps,
        weight: i.weight,
        durationSec: i.durationSec,
        distanceM: i.distanceM,
        calories: i.calories,
        sets: i.sets.map(({ id: _id, ...s }) => s),
      })),
    })),
  );

/** Whether each part would change the routine (the dialog disables the ones that wouldn't). */
export function routineUpdateChanges(
  routine: BlockDraft[],
  session: SessionBlockInput[],
  locationId: string | null,
): RoutineUpdateOptions {
  const before = shape(routine);
  const changes = (options: RoutineUpdateOptions) =>
    shape(updateRoutineBlocks(routine, session, options, locationId)) !== before;
  return {
    structure: changes({ structure: true, values: false }),
    values: changes({ structure: false, values: true }),
  };
}
