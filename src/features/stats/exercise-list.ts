// SPDX-License-Identifier: AGPL-3.0-or-later
import { daysBetween } from '@/features/home/stats';
import { formatWeight } from '@/lib/format';

/** A completed set that counts toward stats (no warm-ups), from an exercises block. */
export type ExerciseSetRow = {
  exerciseId: string;
  sessionId: string;
  completedAt: number;
  weight: number | null;
  reps: number | null;
};

/** What the exercise list shows next to each exercise. */
export type ExerciseMark = {
  /** The best set: "82,5 kg × 8", or "11 reps" without load. */
  text: string;
  /** When that best set was done. */
  at: number;
  /** The best set is recent and beat an earlier session: shown as a record. */
  fresh: boolean;
  /** Last time the exercise was done. */
  lastAt: number;
};

/** A record counts as new for this many days. */
export const FRESH_DAYS = 14;

/** Whether `at` is recent enough to be shown as a new record. */
export const isFresh = (at: number, now: number) => daysBetween(at, now) <= FRESH_DAYS;

const beats = (a: ExerciseSetRow, b: ExerciseSetRow) => {
  const [aw, bw] = [a.weight ?? 0, b.weight ?? 0];
  if (aw !== bw) return aw > bw;
  return (a.reps ?? 0) > (b.reps ?? 0);
};

/**
 * Best set of each exercise: the heaviest (most reps on a tie, the first time it was done), or the most reps
 * when it was never loaded. `fresh` when it was set in the last `FRESH_DAYS` days and there is an earlier session.
 */
export function exerciseMarks(rows: ExerciseSetRow[], now: number): Map<string, ExerciseMark> {
  const byExercise = new Map<string, ExerciseSetRow[]>();
  for (const r of rows) {
    if ((r.reps ?? 0) <= 0) continue;
    byExercise.set(r.exerciseId, [...(byExercise.get(r.exerciseId) ?? []), r]);
  }
  const marks = new Map<string, ExerciseMark>();
  for (const [id, sets] of byExercise) {
    const ordered = [...sets].sort((a, b) => a.completedAt - b.completedAt);
    const best = ordered.reduce((top, s) => (beats(s, top) ? s : top));
    const earlier = ordered.some((s) => s.sessionId !== best.sessionId && s.completedAt < best.completedAt);
    marks.set(id, {
      text: best.weight ? `${formatWeight(best.weight)} × ${best.reps}` : `${best.reps} reps`,
      at: best.completedAt,
      fresh: earlier && isFresh(best.completedAt, now),
      lastAt: ordered[ordered.length - 1].completedAt,
    });
  }
  return marks;
}

/** Exercises done in the last `days` days, most recent first. */
export function recentExerciseIds(marks: Map<string, ExerciseMark>, now: number, days = 7, limit = 5): string[] {
  return [...marks.entries()]
    .filter(([, m]) => daysBetween(m.lastAt, now) <= days)
    .sort((a, b) => b[1].lastAt - a[1].lastAt)
    .slice(0, limit)
    .map(([id]) => id);
}

/** How many exercises have their best set in the same calendar month as `now`. */
export function recordsThisMonth(marks: Map<string, ExerciseMark>, now: number): number {
  const month = (ts: number) => {
    const d = new Date(ts);
    return d.getFullYear() * 12 + d.getMonth();
  };
  return [...marks.values()].filter((m) => m.fresh && month(m.at) === month(now)).length;
}
