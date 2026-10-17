import type { SetType, WorkoutType } from '@/db/schema';
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

/** "3 × 10 · 60 kg · descanso 1:30" (strength) or "15 reps · 43 kg" (WOD). */
export function describeItem(item: ItemLike, type: WorkoutType): string {
  const parts: string[] = [];
  const amount =
    item.reps != null
      ? `${item.reps}${type === 'strength' ? '' : ' reps'}`
      : item.durationSec != null
        ? formatDuration(item.durationSec)
        : item.distanceM != null
          ? `${item.distanceM} m`
          : item.calories != null
            ? `${item.calories} cal`
            : null;
  if (type === 'strength' && item.sets) parts.push(amount ? `${item.sets} × ${amount}` : `${item.sets} séries`);
  else if (amount) parts.push(amount);
  if (item.weight) parts.push(formatWeight(item.weight));
  if (type === 'strength' && item.restSec) parts.push(`descanso ${formatDuration(item.restSec)}`);
  return parts.join(' · ');
}

type WodLike = {
  type: WorkoutType;
  durationSec: number | null;
  intervalSec: number | null;
  rounds: number | null;
  timeCapSec: number | null;
};

export function describeWorkoutFormat(w: WodLike): string | null {
  switch (w.type) {
    case 'strength':
      return null;
    case 'amrap':
      return `AMRAP em ${formatDuration(w.durationSec ?? 0)}`;
    case 'emom':
      return `EMOM ${w.rounds} rounds a cada ${formatDuration(w.intervalSec ?? 60)}`;
    case 'for_time':
      return [
        w.rounds && w.rounds > 1 ? `${w.rounds} rounds for time` : 'For time',
        w.timeCapSec ? `cap ${formatDuration(w.timeCapSec)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
  }
}

type ResultLike = {
  type: WorkoutType;
  resultTimeSec: number | null;
  resultRounds: number | null;
  resultReps: number | null;
  rx: boolean;
};

export function describeResult(s: ResultLike): string | null {
  let text: string | null = null;
  if (s.type === 'for_time' && s.resultTimeSec != null) text = formatDuration(s.resultTimeSec);
  else if (s.type === 'amrap' || s.type === 'for_time') {
    if (s.resultRounds != null || s.resultReps != null) {
      text = `${s.resultRounds ?? 0} rounds + ${s.resultReps ?? 0} reps`;
      if (s.type === 'for_time') text = `Cap · ${text}`;
    }
  } else if (s.type === 'emom' && s.resultRounds != null) text = `${s.resultRounds} rounds`;
  if (text && s.type !== 'strength') text += s.rx ? ' · Rx' : ' · Scaled';
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
