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
});

export const workoutItems = sqliteTable(
  'workout_items',
  {
    ...syncColumns,
    workoutId: text('workout_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    position: integer('position').notNull(),
    /** Strength: number of sets. */
    sets: integer('sets'),
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
    reps: integer('reps'),
    weight: real('weight'),
    durationSec: integer('duration_sec'),
    distanceM: real('distance_m'),
    calories: integer('calories'),
    restSec: integer('rest_sec'),
    completedAt: integer('completed_at'),
  },
  (t) => [
    index('session_sets_session_idx').on(t.sessionId),
    index('session_sets_exercise_idx').on(t.exerciseId),
  ],
);

export const workoutsRelations = relations(workouts, ({ many }) => ({
  items: many(workoutItems),
}));

export const workoutItemsRelations = relations(workoutItems, ({ one }) => ({
  workout: one(workouts, { fields: [workoutItems.workoutId], references: [workouts.id] }),
  exercise: one(exercises, { fields: [workoutItems.exerciseId], references: [exercises.id] }),
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

/** Tables synced with Supabase, in an order that is safe for upserts. */
export const SYNC_TABLES = { exercises, workouts, workoutItems, sessions, sessionSets } as const;
