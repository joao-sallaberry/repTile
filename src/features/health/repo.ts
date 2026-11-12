import { and, eq, gte, inArray, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { sessionHealth, sessions } from '@/db/schema';
import { createdFields, touched } from '@/lib/ids';

import { healthStatus, readCalories, readExercises, readHeartRate, READ_WINDOW_MS } from './client';
import { summarizeHeartRate } from './heart-rate';
import { bestMatch, type AutoLinkResult, type HealthExercise } from './match';

/** Margin around a session when looking for exercise records (the watch may start a bit earlier/later). */
const MARGIN_MS = 2 * 60 * 60_000;

async function healthRow(sessionId: string) {
  const [row] = await db
    .select()
    .from(sessionHealth)
    .where(and(eq(sessionHealth.sessionId, sessionId), isNull(sessionHealth.deletedAt)));
  return row;
}

async function saveRow(sessionId: string, values: Partial<typeof sessionHealth.$inferInsert>) {
  const row = await healthRow(sessionId);
  if (row) {
    await db.update(sessionHealth).set({ ...values, ...touched() }).where(eq(sessionHealth.id, row.id));
  } else {
    await db.insert(sessionHealth).values({ ...createdFields(), sessionId, ...values });
  }
}

/** Links an exercise record to a session: snapshots its heart rate and calories. */
export async function linkHealth(sessionId: string, exercise: HealthExercise) {
  const [samples, calories] = await Promise.all([
    readHeartRate(exercise.start, exercise.end),
    readCalories(exercise.start, exercise.end),
  ]);
  const hr = summarizeHeartRate(samples, exercise.start, exercise.end);
  await saveRow(sessionId, {
    recordId: exercise.id,
    source: exercise.source,
    exerciseType: exercise.exerciseType,
    title: exercise.title,
    startedAt: exercise.start,
    finishedAt: exercise.end,
    avgHr: hr?.avg ?? null,
    maxHr: hr?.max ?? null,
    minHr: hr?.min ?? null,
    calories,
    hrSeries: hr?.perMinute ?? null,
    unlinked: false,
  });
}

/** Removes the link and keeps the session from being matched again automatically. */
export async function unlinkHealth(sessionId: string) {
  await saveRow(sessionId, {
    recordId: null,
    source: null,
    exerciseType: null,
    title: null,
    startedAt: null,
    finishedAt: null,
    avgHr: null,
    maxHr: null,
    minHr: null,
    calories: null,
    hrSeries: null,
    unlinked: true,
  });
}

/** Exercise records around a session, for the manual picker. */
export async function exercisesAround(session: { startedAt: number; finishedAt: number | null }) {
  const end = session.finishedAt ?? session.startedAt;
  return readExercises(session.startedAt - MARGIN_MS, end + MARGIN_MS);
}

/**
 * Links finished sessions of the last 30 days that have no Health Connect data yet (and weren't unlinked)
 * to the best matching exercise record, and re-reads links saved without heart rate: Google Health can
 * write the exercise record before the heart rate samples, and a link is only a snapshot. Limited to
 * `sessionIds` when given. Does nothing without permission.
 */
export async function autoLinkSessions(sessionIds?: string[]): Promise<AutoLinkResult> {
  const none = { pending: 0, records: 0, linked: 0, refreshed: 0 };
  if ((await healthStatus()) !== 'granted') return none;
  const since = Date.now() - READ_WINDOW_MS;
  const candidates = (
    await db
      .select({ id: sessions.id, startedAt: sessions.startedAt, finishedAt: sessions.finishedAt })
      .from(sessions)
      .where(
        and(
          isNull(sessions.deletedAt),
          isNotNull(sessions.finishedAt),
          gte(sessions.startedAt, since),
          sessionIds ? inArray(sessions.id, sessionIds) : undefined,
        ),
      )
  ).filter((s) => s.finishedAt != null);
  const rows = await db.select().from(sessionHealth).where(isNull(sessionHealth.deletedAt));
  const rowOf = new Map(rows.map((r) => [r.sessionId, r]));
  const pending = candidates.filter((s) => !rowOf.has(s.id));

  // Linked, but saved before the heart rate reached Health Connect.
  let refreshed = 0;
  for (const s of candidates) {
    const row = rowOf.get(s.id);
    if (!row || row.unlinked || !row.recordId || row.avgHr != null) continue;
    if (row.startedAt == null || row.finishedAt == null || row.startedAt < since) continue;
    await linkHealth(s.id, {
      id: row.recordId,
      start: row.startedAt,
      end: row.finishedAt,
      exerciseType: row.exerciseType ?? 0,
      title: row.title,
      source: row.source,
    });
    if ((await healthRow(s.id))?.avgHr != null) refreshed += 1;
  }

  if (pending.length === 0) return { ...none, refreshed };
  const from = Math.min(...pending.map((s) => s.startedAt)) - MARGIN_MS;
  const to = Math.max(...pending.map((s) => s.finishedAt!)) + MARGIN_MS;
  const exercises = await readExercises(from, to);
  let count = 0;
  for (const s of pending) {
    const match = bestMatch({ start: s.startedAt, end: s.finishedAt! }, exercises);
    if (!match) continue;
    await linkHealth(s.id, match);
    count += 1;
  }
  return { pending: pending.length, records: exercises.length, linked: count, refreshed };
}
