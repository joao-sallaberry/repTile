// SPDX-License-Identifier: AGPL-3.0-or-later
import { exerciseMarks, recentExerciseIds, recordsThisMonth, type ExerciseSetRow } from './exercise-list';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 20, 12).getTime();
const row = (exerciseId: string, sessionId: string, weight: number | null, reps: number, daysAgo: number): ExerciseSetRow => ({
  exerciseId,
  sessionId,
  weight,
  reps,
  completedAt: NOW - daysAgo * DAY,
});

test('exerciseMarks picks the heaviest set, then the most reps', () => {
  const marks = exerciseMarks(
    [row('bench', 'a', 80, 8, 30), row('bench', 'b', 82.5, 6, 20), row('bench', 'c', 82.5, 8, 2), row('bench', 'c', 60, 15, 2)],
    NOW,
  );
  expect(marks.get('bench')).toMatchObject({ text: '82,5 kg × 8', at: NOW - 2 * DAY, fresh: true, lastAt: NOW - 2 * DAY });
});

test('a best set is only fresh when recent and after an earlier session', () => {
  const marks = exerciseMarks(
    [row('first', 'a', 50, 10, 1), row('old', 'a', 100, 5, 40), row('old', 'b', 90, 5, 1), row('same', 'a', 40, 8, 1), row('same', 'a', 45, 8, 1)],
    NOW,
  );
  expect(marks.get('first')?.fresh).toBe(false);
  expect(marks.get('old')).toMatchObject({ text: '100 kg × 5', fresh: false, lastAt: NOW - DAY });
  expect(marks.get('same')?.fresh).toBe(false);
});

test('exercises without load show their most reps; sets without reps are ignored', () => {
  const marks = exerciseMarks([row('pullup', 'a', null, 9, 9), row('pullup', 'b', 0, 11, 3), row('plank', 'a', null, 0, 3)], NOW);
  expect(marks.get('pullup')?.text).toBe('11 reps');
  expect(marks.has('plank')).toBe(false);
});

test('recentExerciseIds lists what was done in the last week, newest first', () => {
  const marks = exerciseMarks([row('a', 's1', 10, 5, 8), row('b', 's2', 10, 5, 3), row('c', 's3', 10, 5, 1)], NOW);
  expect(recentExerciseIds(marks, NOW)).toEqual(['c', 'b']);
  expect(recentExerciseIds(marks, NOW, 7, 1)).toEqual(['c']);
});

test('recordsThisMonth counts fresh records of the current month', () => {
  const marks = exerciseMarks(
    [row('a', 's1', 10, 5, 40), row('a', 's2', 12, 5, 3), row('b', 's1', 10, 5, 40), row('b', 's3', 12, 5, 25), row('c', 's2', 10, 5, 3)],
    NOW,
  );
  expect(recordsThisMonth(marks, NOW)).toBe(1);
});
