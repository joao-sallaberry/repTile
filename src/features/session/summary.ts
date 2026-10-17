import { and, eq, isNotNull, isNull, lt, ne } from 'drizzle-orm';

import { db } from '@/db/client';
import { sessionBlocks, sessions, type SessionBlock, type SessionSet, type SetType } from '@/db/schema';
import { compareWodResults, computePRs, estimateOneRepMax } from '@/features/stats/prs';
import { describeBlockFormat, isWod } from '@/features/workouts/blocks';
import { describeResult } from '@/features/workouts/describe';
import { formatWeight } from '@/lib/format';

import { performedSets } from './repo';
import { countsTowardStats } from './sets';

/** "2 W + 3 séries", "1 série + 1 D": counts of each set type, as in the summary list. */
export function describeSetCounts(types: SetType[]): string {
  const n = (t: SetType) => types.filter((x) => x === t).length;
  const normal = n('normal');
  return [
    n('warmup') ? `${n('warmup')} W` : null,
    normal ? `${normal} ${normal === 1 ? 'série' : 'séries'}` : null,
    n('drop') ? `${n('drop')} D` : null,
    n('failure') ? `${n('failure')} F` : null,
  ]
    .filter(Boolean)
    .join(' + ');
}

type LoadSet = Pick<SessionSet, 'weight' | 'reps'>;

/** Heaviest set, then the one with most reps. */
export function bestSet<T extends LoadSet>(sets: T[]): T | undefined {
  return sets.reduce<T | undefined>(
    (best, s) =>
      !best || (s.weight ?? 0) > (best.weight ?? 0) || ((s.weight ?? 0) === (best.weight ?? 0) && (s.reps ?? 0) > (best.reps ?? 0))
        ? s
        : best,
    undefined,
  );
}

/** "82,5 kg × 8", or "12 reps" without load. */
export const describeSet = (s: LoadSet) => (s.weight ? `${formatWeight(s.weight)} × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`);

const orm = (s: LoadSet) => Math.round(estimateOneRepMax(s.weight ?? 0, s.reps ?? 0) * 10) / 10;

export type SetRecord = {
  kind: 'set';
  key: string;
  exerciseId: string;
  machineId: string | null;
  /** "maior carga" or "1RM estimado". */
  what: string;
  detail: string;
};
export type WodRecord = { kind: 'wod'; key: string; title: string; detail: string };
export type SessionRecord = SetRecord | WodRecord;

/**
 * What each record set beat: a heavier load than ever ("maior carga"), else a higher estimated 1RM.
 * `previous` are the earlier working sets of the same exercise + machine.
 */
export function describeSetRecord(best: LoadSet, previous: LoadSet[]): { what: string; detail: string } {
  const before = computePRs(previous.map((p, i) => ({ ...p, sessionId: String(i), completedAt: i })));
  const max = before.maxWeight;
  if (!max || (best.weight ?? 0) > max.value) {
    return {
      what: 'maior carga',
      detail: max ? `${describeSet(best)} · antes ${describeSet({ weight: max.value, reps: max.reps })}` : describeSet(best),
    };
  }
  const prev = before.bestOneRepMax?.value;
  return {
    what: '1RM estimado',
    detail: `${formatWeight(orm(best))} (${describeSet(best)})${prev ? ` · antes ${formatWeight(Math.round(prev * 10) / 10)}` : ''}`,
  };
}

/** The session's records: one per exercise + machine with a record set, plus WOD block records, with what they beat. */
export async function loadSessionRecords(sessionId: string, sets: SessionSet[], blocks: SessionBlock[]): Promise<SessionRecord[]> {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) return [];
  const records: SessionRecord[] = [];

  const groups = new Map<string, SessionSet[]>();
  for (const s of sets) {
    if (!s.isPr) continue;
    const key = `${s.exerciseId}:${s.machineId ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  for (const [key, list] of groups) {
    const best = bestSet(list)!;
    const previous = (await performedSets(best.exerciseId, { machineId: best.machineId, excludeSessionId: sessionId })).filter(
      (p) => countsTowardStats(p.type) && p.completedAt < session.startedAt,
    );
    records.push({ kind: 'set', key, exerciseId: best.exerciseId, machineId: best.machineId, ...describeSetRecord(best, previous) });
  }

  for (const b of blocks) {
    if (!b.isPr || !isWod(b.kind) || !b.workoutBlockId) continue;
    const earlier = await db
      .select({ block: sessionBlocks })
      .from(sessionBlocks)
      .innerJoin(sessions, eq(sessions.id, sessionBlocks.sessionId))
      .where(
        and(
          eq(sessionBlocks.workoutBlockId, b.workoutBlockId),
          ne(sessionBlocks.id, b.id),
          isNotNull(sessionBlocks.finishedAt),
          isNull(sessionBlocks.deletedAt),
          isNull(sessions.deletedAt),
          lt(sessions.startedAt, session.startedAt),
        ),
      );
    const kind = b.kind;
    const prevBest = earlier
      .map((r) => r.block)
      .reduce<SessionBlock | undefined>((best, r) => (!best || compareWodResults(kind, r, best) > 0 ? r : best), undefined);
    const now = describeResult({ ...b, rx: b.rx }) ?? '';
    const before = prevBest ? describeResult(prevBest) : null;
    records.push({ kind: 'wod', key: b.id, title: describeBlockFormat(b) ?? 'WOD', detail: before ? `${now} · antes ${before}` : now });
  }
  return records;
}
