/**
 * Which Google Health records become history entries of their own (ADR 0025). Pure: works on plain
 * timestamps so it can be tested; `repo.ts` reads Health Connect and writes the sessions.
 */
import { compareText } from '@/lib/collate';

import { exerciseName, type HealthExercise } from './match';

/** Key of an activity the user can pick: its display name, case-insensitive ("CrossFit", "Musculação"). */
export const activityKey = (name: string) => name.trim().toLocaleLowerCase('pt-BR');

/** Whether a record is of one of the picked activities. */
export const isPickedActivity = (record: Pick<HealthExercise, 'title' | 'exerciseType'>, picked: readonly string[]) =>
  picked.some((p) => activityKey(p) === activityKey(exerciseName(record)));

/** Records this short or shorter (accidental starts on the watch) are never imported. */
export const MIN_IMPORT_MS = 60_000;

/** A time span; `end: null` = still in progress (counts up to `now`). */
type Span = { start: number; end: number | null };

const overlaps = (a: { start: number; end: number }, b: Span, now: number) =>
  Math.min(a.end, b.end ?? now) > Math.max(a.start, b.start);

/**
 * Records to import: longer than a minute, of a picked activity, not already known (linked to a session, imported, or imported and
 * then deleted from the history) and not at the same time as any RepTile workout, finished or in progress.
 */
export function recordsToImport<T extends HealthExercise>(
  records: readonly T[],
  {
    picked,
    knownRecordIds,
    appSessions,
    now,
  }: { picked: readonly string[]; knownRecordIds: ReadonlySet<string>; appSessions: readonly Span[]; now: number },
): T[] {
  if (picked.length === 0) return [];
  return records.filter(
    (r) =>
      r.end - r.start > MIN_IMPORT_MS &&
      !knownRecordIds.has(r.id) &&
      isPickedActivity(r, picked) &&
      !appSessions.some((s) => overlaps(r, s, now)),
  );
}

/**
 * Imported sessions that a RepTile workout now covers (one done or retimed after the import): they leave the
 * history so the record can be linked to that workout instead.
 */
export function supersededImports<T extends { id: string; start: number; end: number }>(
  imported: readonly T[],
  appSessions: readonly Span[],
  now: number,
): T[] {
  return imported.filter((i) => appSessions.some((s) => overlaps(i, s, now)));
}

/** Activities found in Health Connect, most frequent first, for the Ajustes picker. */
export function activityNames(records: readonly Pick<HealthExercise, 'title' | 'exerciseType'>[]) {
  const by = new Map<string, { name: string; count: number }>();
  for (const r of records) {
    const name = exerciseName(r);
    const key = activityKey(name);
    const cur = by.get(key);
    by.set(key, { name: cur?.name ?? name, count: (cur?.count ?? 0) + 1 });
  }
  return [...by.values()].sort((a, b) => b.count - a.count || compareText(a.name, b.name));
}

/** Outcome of an import run. */
export type ImportResult = { imported: number; removed: number };

/** Ajustes feedback after an import. */
export function importMessage({ imported, removed }: ImportResult) {
  const parts = [
    imported === 0 ? 'Nenhuma atividade nova' : imported === 1 ? '1 atividade importada' : `${imported} atividades importadas`,
    removed === 0 ? null : removed === 1 ? '1 substituída por um treino do app' : `${removed} substituídas por treinos do app`,
  ];
  return parts.filter(Boolean).join('; ');
}
