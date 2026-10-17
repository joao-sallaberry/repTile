import type { BlockKind, WodKind } from '@/db/schema';
import type { TimerSpec } from '@/features/timer/engine';
import { formatDuration } from '@/lib/format';

export const BLOCK_KIND_LABEL: Record<BlockKind, string> = {
  exercises: 'Exercícios',
  amrap: 'AMRAP',
  emom: 'EMOM',
  for_time: 'For Time',
  tabata: 'Tabata',
};

export const BLOCK_KIND_ICON: Record<BlockKind, string> = {
  exercises: 'dumbbell',
  amrap: 'timer-sand',
  emom: 'timer-outline',
  for_time: 'flag-checkered',
  tabata: 'repeat',
};

export const WOD_KINDS: WodKind[] = ['amrap', 'emom', 'for_time', 'tabata'];

export const isWod = (kind: BlockKind): kind is WodKind => kind !== 'exercises';

export type BlockConfig = {
  kind: BlockKind;
  durationSec: number | null;
  intervalSec: number | null;
  rounds: number | null;
  timeCapSec: number | null;
  workSec: number | null;
  restSec: number | null;
  alternate: boolean;
};

/** Default settings for a new block of a kind. */
export function defaultBlockConfig(kind: BlockKind): BlockConfig {
  return {
    kind,
    durationSec: kind === 'amrap' ? 12 * 60 : null,
    intervalSec: kind === 'emom' ? 60 : null,
    rounds: kind === 'emom' ? 10 : kind === 'for_time' ? 3 : kind === 'tabata' ? 8 : null,
    timeCapSec: kind === 'for_time' ? 15 * 60 : null,
    workSec: kind === 'tabata' ? 20 : null,
    restSec: kind === 'tabata' ? 10 : null,
    alternate: false,
  };
}

/** Keeps only the settings that apply to the block's kind. */
export function cleanBlockConfig<T extends BlockConfig>(b: T): T {
  return {
    ...b,
    durationSec: b.kind === 'amrap' ? b.durationSec : null,
    intervalSec: b.kind === 'emom' ? b.intervalSec : null,
    rounds: b.kind === 'emom' || b.kind === 'for_time' || b.kind === 'tabata' ? b.rounds : null,
    timeCapSec: b.kind === 'for_time' ? b.timeCapSec : null,
    workSec: b.kind === 'tabata' ? b.workSec : null,
    restSec: b.kind === 'tabata' ? b.restSec : null,
    alternate: b.kind === 'emom' ? b.alternate : false,
  };
}

/** "AMRAP 20 min", "EMOM 12 × 1:00 · alternado", "3 rounds for time · cap 15:00", "Tabata 8 × 20s/10s"; null for exercises. */
export function describeBlockFormat(b: BlockConfig): string | null {
  switch (b.kind) {
    case 'exercises':
      return null;
    case 'amrap':
      return `AMRAP ${formatMinutesShort(b.durationSec ?? 0)}`;
    case 'emom': {
      const interval = b.intervalSec ?? 60;
      const base = interval === 60 ? `EMOM ${b.rounds ?? 0} min` : `EMOM ${b.rounds ?? 0} × ${formatDuration(interval)}`;
      return b.alternate ? `${base} · alternado` : base;
    }
    case 'for_time':
      return [
        b.rounds && b.rounds > 1 ? `${b.rounds} rounds for time` : 'For time',
        b.timeCapSec ? `cap ${formatDuration(b.timeCapSec)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'tabata':
      return `Tabata ${b.rounds ?? 0} × ${formatSecondsShort(b.workSec ?? 0)}/${formatSecondsShort(b.restSec ?? 0)}`;
  }
}

/** 1200 -> "20 min"; 90 -> "1:30". */
function formatMinutesShort(sec: number) {
  return sec % 60 === 0 ? `${sec / 60} min` : formatDuration(sec);
}

/** 20 -> "20s"; 90 -> "1:30". */
function formatSecondsShort(sec: number) {
  return sec < 60 ? `${sec}s` : formatDuration(sec);
}

/** Short summary of a routine's blocks: "5 exercícios + EMOM 12 min". */
export function describeShape(blocks: (BlockConfig & { itemCount: number })[]): string {
  const exercises = blocks.filter((b) => b.kind === 'exercises').reduce((n, b) => n + b.itemCount, 0);
  const parts = [
    exercises ? `${exercises} ${exercises === 1 ? 'exercício' : 'exercícios'}` : null,
    ...blocks.filter((b) => isWod(b.kind)).map((b) => describeBlockFormat({ ...b, alternate: false })),
  ].filter(Boolean);
  return parts.join(' + ') || 'Vazio';
}

/** Icon for a routine: dumbbell if it has exercises, else its first WOD's icon. */
export function workoutIcon(kinds: BlockKind[]): string {
  if (!kinds.length || kinds.includes('exercises')) return BLOCK_KIND_ICON.exercises;
  return BLOCK_KIND_ICON[kinds[0]];
}

/** Timer for a WOD block. */
export function blockTimerSpec(b: BlockConfig): TimerSpec {
  switch (b.kind) {
    case 'amrap':
      return { kind: 'amrap', durationSec: b.durationSec ?? 600 };
    case 'emom':
      return { kind: 'emom', intervalSec: b.intervalSec ?? 60, rounds: b.rounds ?? 10 };
    case 'tabata':
      return { kind: 'tabata', workSec: b.workSec ?? 20, restSec: b.restSec ?? 10, rounds: b.rounds ?? 8 };
    default:
      return { kind: 'for_time', timeCapSec: b.timeCapSec };
  }
}

/** Alternating EMOM: index of the movement for a 1-based round (A, B, C, A, B, …); null when not alternating. */
export function emomMovementIndex(round: number, movementCount: number, alternate: boolean): number | null {
  if (!alternate || movementCount === 0 || round < 1) return null;
  return (round - 1) % movementCount;
}

/** Tabata: the movement of a 1-based round, cycling through the movements (A, B, A, B, …). */
export function tabataMovementIndex(round: number, movementCount: number): number | null {
  if (movementCount === 0 || round < 1) return null;
  return (round - 1) % movementCount;
}

/** Durations of each round from the elapsed seconds at the end of each one: [231, 402] -> [231, 171]. */
export function splitDurations(splits: number[]): number[] {
  return splits.map((at, i) => at - (i ? splits[i - 1] : 0));
}

/** Tabata score: the round with the fewest reps (null with no rounds). */
export function worstRound(reps: number[]): number | null {
  return reps.length ? Math.min(...reps) : null;
}
