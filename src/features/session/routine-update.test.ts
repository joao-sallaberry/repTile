import type { BlockDraft, WorkoutItemDraft } from '@/features/workouts/repo';

import {
  routineUpdateChanges,
  updateRoutineBlocks,
  type SessionBlockInput,
  type SessionExercise,
} from './routine-update';

const config = { durationSec: null, intervalSec: null, rounds: null, timeCapSec: null, workSec: null, restSec: null, alternate: false };

const item = (exerciseId: string, weight = 20, restSec: number | null = 90): WorkoutItemDraft => ({
  id: `item-${exerciseId}`,
  exerciseId,
  equipment: 'barbell',
  machineId: null,
  sets: [
    { id: `${exerciseId}-s0`, type: 'normal', reps: 10, weight, durationSec: null, distanceM: null, calories: null },
    { id: `${exerciseId}-s1`, type: 'normal', reps: 10, weight, durationSec: null, distanceM: null, calories: null },
  ],
  reps: null,
  weight: null,
  durationSec: null,
  distanceM: null,
  calories: null,
  restSec,
  notes: 'nota',
});

const block = (id: string, items: WorkoutItemDraft[]): BlockDraft => ({
  id,
  kind: 'exercises',
  ...config,
  locationId: null,
  notes: null,
  items,
});

const done = (exerciseId: string, weight: number, n = 2, restSec: number | null = 90): SessionExercise => ({
  exerciseId,
  sets: Array.from({ length: n }, () => ({
    type: 'normal' as const,
    reps: 8,
    weight,
    durationSec: null,
    distanceM: null,
    calories: null,
    restSec,
    equipment: 'barbell' as const,
    machineId: null,
    completedAt: 1,
  })),
});

const notDone = (exerciseId: string): SessionExercise => ({
  exerciseId,
  sets: done(exerciseId, 20).sets.map((s) => ({ ...s, completedAt: null })),
});

const sBlock = (workoutBlockId: string | null, exercises: SessionExercise[]): SessionBlockInput => ({
  workoutBlockId,
  kind: 'exercises',
  ...config,
  exercises,
});

const routine = () => [block('b1', [item('squat'), item('bench'), item('row')])];
const ids = (blocks: BlockDraft[]) => blocks.map((b) => b.items.map((i) => i.exerciseId));

describe('updateRoutineBlocks', () => {
  // Session: bench and squat swapped, row removed, curl added; squat heavier with 60 s rest.
  const session = [sBlock('b1', [done('bench', 20), done('squat', 30, 3, 60), done('curl', 10)])];

  it('values only: copies sets, loads and rest of the items done, keeping the structure', () => {
    const [b] = updateRoutineBlocks(routine(), session, { structure: false, values: true }, null);
    expect(ids([b])).toEqual([['squat', 'bench', 'row']]);
    const squat = b.items[0];
    expect(squat.sets.map((s) => s.weight)).toEqual([30, 30, 30]);
    expect(squat.sets.map((s) => s.id)).toEqual(['squat-s0', 'squat-s1', undefined]);
    expect(squat.restSec).toBe(60);
    expect(b.items[2].sets.map((s) => s.weight)).toEqual([20, 20]);
  });

  it('structure only: session order, added and removed exercises, targets kept', () => {
    const [b] = updateRoutineBlocks(routine(), session, { structure: true, values: false }, null);
    expect(ids([b])).toEqual([['bench', 'squat', 'curl']]);
    const squat = b.items[1];
    expect(squat.id).toBe('item-squat');
    expect(squat.sets.map((s) => s.weight)).toEqual([20, 20]);
    expect(squat.restSec).toBe(90);
    expect(squat.notes).toBe('nota');
    const curl = b.items[2];
    expect(curl.id).toBeUndefined();
    expect(curl.sets.map((s) => s.weight)).toEqual([10, 10]);
  });

  it('both: new structure with the values done', () => {
    const [b] = updateRoutineBlocks(routine(), session, { structure: true, values: true }, null);
    expect(ids([b])).toEqual([['bench', 'squat', 'curl']]);
    expect(b.items[1].sets.map((s) => s.weight)).toEqual([30, 30, 30]);
  });

  it('does not modify the routine it is given', () => {
    const r = routine();
    updateRoutineBlocks(r, session, { structure: true, values: true }, null);
    expect(r).toEqual(routine());
  });

  it('keeps targets of exercises that were not done', () => {
    const [b] = updateRoutineBlocks(routine(), [sBlock('b1', [notDone('squat'), done('bench', 25), done('row', 20)])], { structure: false, values: true }, null);
    expect(b.items[0].sets.map((s) => s.weight)).toEqual([20, 20]);
    expect(b.items[1].sets.map((s) => s.weight)).toEqual([25, 25]);
  });

  it('structure: blocks follow the session, added blocks go to the variant, removed ones go away', () => {
    const r = [block('b1', [item('squat')]), block('b2', [item('bench')])];
    const wod: SessionBlockInput = {
      workoutBlockId: null,
      kind: 'amrap',
      ...config,
      durationSec: 600,
      exercises: [{ exerciseId: 'burpee', sets: [{ ...done('burpee', 0, 1).sets[0], reps: 10, weight: null }] }],
    };
    const out = updateRoutineBlocks(r, [wod, sBlock('b1', [done('squat', 20)])], { structure: true, values: false }, 'loc-1');
    expect(out.map((b) => b.id)).toEqual([undefined, 'b1']);
    expect(out[0]).toMatchObject({ kind: 'amrap', durationSec: 600, locationId: 'loc-1' });
    expect(out[0].items[0]).toMatchObject({ exerciseId: 'burpee', reps: 10, sets: [] });
  });
});

describe('routineUpdateChanges', () => {
  it('tells which parts would change something', () => {
    const asPlanned = { exerciseId: 'squat', sets: done('squat', 20).sets.map((s) => ({ ...s, reps: 10 })) };
    const same = [sBlock('b1', [asPlanned, notDone('bench'), notDone('row')])];
    expect(routineUpdateChanges(routine(), same, null)).toEqual({ structure: false, values: false });
    const heavier = [sBlock('b1', [done('squat', 30), notDone('bench'), notDone('row')])];
    expect(routineUpdateChanges(routine(), heavier, null)).toEqual({ structure: false, values: true });
    const reordered = [sBlock('b1', [notDone('bench'), notDone('squat'), notDone('row')])];
    expect(routineUpdateChanges(routine(), reordered, null)).toEqual({ structure: true, values: false });
  });
});
