import { relations } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Columns shared by every synced table.
 * - `id`: UUID generated on the device (allows creating records offline).
 * - `dirty`: 1 when there is a local change not yet pushed to Supabase.
 * - `deletedAt`: soft delete, so deletions are synced too.
 */
const syncColumns = {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
};

export const MEASURES = ['weight_reps', 'reps', 'time', 'distance', 'calories'] as const;
export type Measure = (typeof MEASURES)[number];

export const WORKOUT_TYPES = ['strength', 'amrap', 'emom', 'for_time'] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

/** Set kinds, as in Hevy: warm-up sets don't count towards volume or PRs. */
export const SET_TYPES = ['warmup', 'normal', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];

export const LOCATION_KINDS = ['gym', 'box'] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

/** A place where the user trains (a gym or a CrossFit box). */
export const locations = sqliteTable('locations', {
  ...syncColumns,
  name: text('name').notNull(),
  kind: text('kind', { enum: LOCATION_KINDS }).notNull().default('gym'),
});

/**
 * A specific machine (or machine model). Machines are optional and independent of
 * locations: `location_machines` links them N:N, `machine_exercises` says which
 * exercises can be done on each one. Loads and PRs are tracked per machine.
 */
export const machines = sqliteTable('machines', {
  ...syncColumns,
  name: text('name').notNull(),
  /** File name of a low-res JPEG in the app's document dir (see features/places/photos.ts). Local only for now. */
  photo: text('photo'),
});

export const locationMachines = sqliteTable(
  'location_machines',
  {
    ...syncColumns,
    locationId: text('location_id').notNull(),
    machineId: text('machine_id').notNull(),
  },
  (t) => [index('location_machines_location_idx').on(t.locationId), index('location_machines_machine_idx').on(t.machineId)],
);

export const machineExercises = sqliteTable(
  'machine_exercises',
  {
    ...syncColumns,
    machineId: text('machine_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
  },
  (t) => [index('machine_exercises_machine_idx').on(t.machineId), index('machine_exercises_exercise_idx').on(t.exerciseId)],
);

export const exercises = sqliteTable('exercises', {
  ...syncColumns,
  name: text('name').notNull(),
  category: text('category').notNull(),
  measure: text('measure', { enum: MEASURES }).notNull(),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
});

export const workouts = sqliteTable('workouts', {
  ...syncColumns,
  name: text('name').notNull(),
  type: text('type', { enum: WORKOUT_TYPES }).notNull(),
  notes: text('notes'),
  /** AMRAP: total duration. */
  durationSec: integer('duration_sec'),
  /** EMOM: duration of each interval. */
  intervalSec: integer('interval_sec'),
  /** EMOM: number of intervals; For Time: number of rounds. */
  rounds: integer('rounds'),
  /** For Time: time cap (optional). */
  timeCapSec: integer('time_cap_sec'),
  locationId: text('location_id'),
});

export const workoutItems = sqliteTable(
  'workout_items',
  {
    ...syncColumns,
    workoutId: text('workout_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    position: integer('position').notNull(),
    /** Strength: number of sets (mirrors the rows in `workout_item_sets`). */
    sets: integer('sets'),
    machineId: text('machine_id'),
    reps: integer('reps'),
    weight: real('weight'),
    durationSec: integer('duration_sec'),
    distanceM: real('distance_m'),
    calories: integer('calories'),
    restSec: integer('rest_sec'),
    notes: text('notes'),
  },
  (t) => [index('workout_items_workout_idx').on(t.workoutId)],
);

/** Strength: the planned target of each set of a workout item (weight/reps may vary per set). */
export const workoutItemSets = sqliteTable(
  'workout_item_sets',
  {
    ...syncColumns,
    workoutItemId: text('workout_item_id').notNull(),
    position: integer('position').notNull(),
    type: text('type', { enum: SET_TYPES }).notNull().default('normal'),
    reps: integer('reps'),
    weight: real('weight'),
    durationSec: integer('duration_sec'),
    distanceM: real('distance_m'),
    calories: integer('calories'),
  },
  (t) => [index('workout_item_sets_item_idx').on(t.workoutItemId)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    ...syncColumns,
    workoutId: text('workout_id'),
    /** Snapshot of the workout name/config at the time it was performed. */
    name: text('name').notNull(),
    type: text('type', { enum: WORKOUT_TYPES }).notNull(),
    durationSec: integer('duration_sec'),
    intervalSec: integer('interval_sec'),
    rounds: integer('rounds'),
    timeCapSec: integer('time_cap_sec'),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
    resultTimeSec: integer('result_time_sec'),
    resultRounds: integer('result_rounds'),
    resultReps: integer('result_reps'),
    rx: integer('rx', { mode: 'boolean' }).notNull().default(true),
    notes: text('notes'),
    locationId: text('location_id'),
    /** WODs: the result beat every earlier session of the same routine (set on finish). */
    isPr: integer('is_pr', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('sessions_started_idx').on(t.startedAt)],
);

export const sessionSets = sqliteTable(
  'session_sets',
  {
    ...syncColumns,
    sessionId: text('session_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    /** Exercise order within the session. */
    position: integer('position').notNull(),
    setIndex: integer('set_index').notNull(),
    type: text('type', { enum: SET_TYPES }).notNull().default('normal'),
    machineId: text('machine_id'),
    reps: integer('reps'),
    weight: real('weight'),
    durationSec: integer('duration_sec'),
    distanceM: real('distance_m'),
    calories: integer('calories'),
    restSec: integer('rest_sec'),
    completedAt: integer('completed_at'),
    /** The set was a personal record when it was completed (same exercise + machine, warm-ups excluded). */
    isPr: integer('is_pr', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    index('session_sets_session_idx').on(t.sessionId),
    index('session_sets_exercise_idx').on(t.exerciseId),
  ],
);

export const workoutsRelations = relations(workouts, ({ many }) => ({
  items: many(workoutItems),
}));

export const workoutItemsRelations = relations(workoutItems, ({ one, many }) => ({
  workout: one(workouts, { fields: [workoutItems.workoutId], references: [workouts.id] }),
  exercise: one(exercises, { fields: [workoutItems.exerciseId], references: [exercises.id] }),
  targetSets: many(workoutItemSets),
}));

export const workoutItemSetsRelations = relations(workoutItemSets, ({ one }) => ({
  item: one(workoutItems, { fields: [workoutItemSets.workoutItemId], references: [workoutItems.id] }),
}));

export const sessionsRelations = relations(sessions, ({ many }) => ({
  sets: many(sessionSets),
}));

export const sessionSetsRelations = relations(sessionSets, ({ one }) => ({
  session: one(sessions, { fields: [sessionSets.sessionId], references: [sessions.id] }),
  exercise: one(exercises, { fields: [sessionSets.exerciseId], references: [exercises.id] }),
}));

export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutItem = typeof workoutItems.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionSet = typeof sessionSets.$inferSelect;
export type WorkoutItemSet = typeof workoutItemSets.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Machine = typeof machines.$inferSelect;

/** Tables synced with Supabase, in an order that is safe for upserts. */
export const SYNC_TABLES = {
  exercises,
  locations,
  machines,
  locationMachines,
  machineExercises,
  workouts,
  workoutItems,
  workoutItemSets,
  sessions,
  sessionSets,
} as const;
