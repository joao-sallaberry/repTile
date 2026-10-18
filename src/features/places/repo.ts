import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  exercises,
  locationMachines,
  locations,
  machineExercises,
  machines,
  type Exercise,
  type Location,
  type LocationKind,
  type Machine,
} from '@/db/schema';
import { createdFields, touched } from '@/lib/ids';

export async function createLocation(input: { name: string; kind: LocationKind }) {
  const row = { ...createdFields(), ...input };
  await db.insert(locations).values(row);
  return row.id;
}

export async function updateLocation(id: string, values: Partial<{ name: string; kind: LocationKind }>) {
  await db.update(locations).set({ ...values, ...touched() }).where(eq(locations.id, id));
}

export async function deleteLocation(id: string) {
  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.update(locations).set({ deletedAt: now, ...touched() }).where(eq(locations.id, id));
    await tx
      .update(locationMachines)
      .set({ deletedAt: now, ...touched() })
      .where(and(eq(locationMachines.locationId, id), isNull(locationMachines.deletedAt)));
  });
}

/** Links a machine to a location (no-op if already linked). */
export async function linkMachineToLocation(machineId: string, locationId: string) {
  const existing = await db.query.locationMachines.findFirst({
    where: and(
      eq(locationMachines.machineId, machineId),
      eq(locationMachines.locationId, locationId),
      isNull(locationMachines.deletedAt),
    ),
  });
  if (!existing) await db.insert(locationMachines).values({ ...createdFields(), machineId, locationId });
}

export async function unlinkMachineFromLocation(machineId: string, locationId: string) {
  await db
    .update(locationMachines)
    .set({ deletedAt: Date.now(), ...touched() })
    .where(
      and(
        eq(locationMachines.machineId, machineId),
        eq(locationMachines.locationId, locationId),
        isNull(locationMachines.deletedAt),
      ),
    );
}

export async function linkMachineToExercise(machineId: string, exerciseId: string) {
  const existing = await db.query.machineExercises.findFirst({
    where: and(
      eq(machineExercises.machineId, machineId),
      eq(machineExercises.exerciseId, exerciseId),
      isNull(machineExercises.deletedAt),
    ),
  });
  if (!existing) await db.insert(machineExercises).values({ ...createdFields(), machineId, exerciseId });
  // An exercise done on a machine is a machine exercise.
  await db
    .update(exercises)
    .set({ equipment: 'machine', ...touched() })
    .where(and(eq(exercises.id, exerciseId), ne(exercises.equipment, 'machine')));
}

export async function unlinkMachineFromExercise(machineId: string, exerciseId: string) {
  await db
    .update(machineExercises)
    .set({ deletedAt: Date.now(), ...touched() })
    .where(
      and(
        eq(machineExercises.machineId, machineId),
        eq(machineExercises.exerciseId, exerciseId),
        isNull(machineExercises.deletedAt),
      ),
    );
}

/** Creates a machine, optionally linking it to an exercise and a location right away. */
export async function createMachine(input: { name: string; exerciseId?: string | null; locationId?: string | null }) {
  const row = { ...createdFields(), name: input.name };
  await db.insert(machines).values(row);
  if (input.exerciseId) await linkMachineToExercise(row.id, input.exerciseId);
  if (input.locationId) await linkMachineToLocation(row.id, input.locationId);
  return row.id;
}

export async function updateMachine(id: string, name: string) {
  await db.update(machines).set({ name, ...touched() }).where(eq(machines.id, id));
}

export async function deleteMachine(id: string) {
  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.update(machines).set({ deletedAt: now, ...touched() }).where(eq(machines.id, id));
    for (const t of [locationMachines, machineExercises]) {
      await tx.update(t).set({ deletedAt: now, ...touched() }).where(and(eq(t.machineId, id), isNull(t.deletedAt)));
    }
  });
}

/** Active location ids each machine belongs to. */
export async function locationsByMachine(machineIds: string[]): Promise<Map<string, Location[]>> {
  const map = new Map<string, Location[]>();
  if (!machineIds.length) return map;
  const rows = await db
    .select({ machineId: locationMachines.machineId, location: locations })
    .from(locationMachines)
    .innerJoin(locations, eq(locations.id, locationMachines.locationId))
    .where(
      and(
        inArray(locationMachines.machineId, machineIds),
        isNull(locationMachines.deletedAt),
        isNull(locations.deletedAt),
      ),
    )
    .orderBy(asc(locations.name));
  for (const r of rows) map.set(r.machineId, [...(map.get(r.machineId) ?? []), r.location]);
  return map;
}

export type MachineOption = { machine: Machine; locations: Location[] };

/**
 * Every machine, grouped for picking one for an exercise: the ones already used for it (those at
 * `locationId` first), the other machines at `locationId`, and the rest. Any machine can be picked
 * for any exercise (picking one links it).
 */
export async function machinesForExercise(
  exerciseId: string,
  locationId: string | null,
): Promise<{ forExercise: MachineOption[]; here: MachineOption[]; others: MachineOption[] }> {
  const all = await db.select().from(machines).where(isNull(machines.deletedAt)).orderBy(asc(machines.name));
  const linked = await db
    .select({ machineId: machineExercises.machineId })
    .from(machineExercises)
    .where(and(eq(machineExercises.exerciseId, exerciseId), isNull(machineExercises.deletedAt)));
  const linkedIds = new Set(linked.map((l) => l.machineId));
  const byMachine = await locationsByMachine(all.map((m) => m.id));
  const options = all.map((machine) => ({ machine, locations: byMachine.get(machine.id) ?? [] }));
  const isHere = (o: MachineOption) => !!locationId && o.locations.some((l) => l.id === locationId);
  const forExercise = options.filter((o) => linkedIds.has(o.machine.id));
  const rest = options.filter((o) => !linkedIds.has(o.machine.id));
  return {
    forExercise: [...forExercise.filter(isHere), ...forExercise.filter((o) => !isHere(o))],
    here: rest.filter(isHere),
    others: rest.filter((o) => !isHere(o)),
  };
}

/** Exercises each machine is used for. */
export async function exercisesByMachine(machineIds: string[]): Promise<Map<string, Exercise[]>> {
  const map = new Map<string, Exercise[]>();
  if (!machineIds.length) return map;
  const rows = await db
    .select({ machineId: machineExercises.machineId, exercise: exercises })
    .from(machineExercises)
    .innerJoin(exercises, eq(exercises.id, machineExercises.exerciseId))
    .where(and(inArray(machineExercises.machineId, machineIds), isNull(machineExercises.deletedAt)))
    .orderBy(asc(exercises.name));
  for (const r of rows) map.set(r.machineId, [...(map.get(r.machineId) ?? []), r.exercise]);
  return map;
}
