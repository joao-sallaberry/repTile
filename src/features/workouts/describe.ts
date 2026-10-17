import type { BlockKind, SetType } from '@/db/schema';
import { formatDuration, formatWeight } from '@/lib/format';

type ItemLike = {
  sets?: number | null;
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
  distanceM: number | null;
  calories: number | null;
  restSec?: number | null;
};

/** "3 × 10 · 60 kg · descanso 1:30" (exercises block) or "15 reps · 43 kg" (WOD block). */
export function describeItem(item: ItemLike, kind: BlockKind): string {
  const plain = kind === 'exercises';
  const parts: string[] = [];
  const amount =
    item.reps != null
      ? `${item.reps}${plain ? '' : ' reps'}`
      : item.durationSec != null
        ? formatDuration(item.durationSec)
        : item.distanceM != null
          ? `${item.distanceM} m`
          : item.calories != null
            ? `${item.calories} cal`
            : null;
  if (plain && item.sets) parts.push(amount ? `${item.sets} × ${amount}` : `${item.sets} séries`);
  else if (amount) parts.push(amount);
  if (item.weight) parts.push(formatWeight(item.weight));
  if (plain && item.restSec) parts.push(`descanso ${formatDuration(item.restSec)}`);
  return parts.join(' · ');
}

type ResultLike = {
  kind: BlockKind;
  resultTimeSec: number | null;
  resultRounds: number | null;
  resultReps: number | null;
  rx: boolean;
};

/** A WOD block's result: "6:42 · Rx", "12 rounds + 5 reps · Scaled", "Cap · 4 rounds + 0 reps · Rx". */
export function describeResult(s: ResultLike): string | null {
  let text: string | null = null;
  if (s.kind === 'for_time' && s.resultTimeSec != null) text = formatDuration(s.resultTimeSec);
  else if (s.kind === 'amrap' || s.kind === 'for_time') {
    if (s.resultRounds != null || s.resultReps != null) {
      text = `${s.resultRounds ?? 0} rounds + ${s.resultReps ?? 0} reps`;
      if (s.kind === 'for_time') text = `Cap · ${text}`;
    }
  } else if (s.kind === 'emom' && s.resultRounds != null) text = `${s.resultRounds} rounds`;
  if (text) text += s.rx ? ' · Rx' : ' · Scaled';
  return text;
}

type TargetLike = { type: SetType; reps: number | null; weight: number | null };

const range = (values: number[], fmt: (n: number) => string) => {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
};
const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

/** "2 aquec. + 3 séries · 75–82,5 kg × 8–10" for a strength item's per-set targets. */
export function describeTargets(sets: TargetLike[]): string {
  const warmups = sets.filter((s) => s.type === 'warmup').length;
  const work = sets.filter((s) => s.type !== 'warmup');
  const count = [warmups ? `${warmups} aquec.` : null, `${work.length} ${work.length === 1 ? 'série' : 'séries'}`]
    .filter(Boolean)
    .join(' + ');
  const w = range(work.flatMap((s) => (s.weight ? [s.weight] : [])), kg);
  const r = range(work.flatMap((s) => (s.reps != null ? [s.reps] : [])), String);
  const load = w && r ? `${w} kg × ${r}` : w ? `${w} kg` : r ? `${r} reps` : null;
  return [count, load].filter(Boolean).join(' · ');
}
