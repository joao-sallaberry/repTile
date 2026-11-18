import type { WodKind } from '@/db/schema';

import { defaultBlockConfig, type BlockConfig } from './blocks';
import { emptyBlock, emptyItem, newSet, type BlockDraft } from './repo';

type ReadyItem = { slug: string; sets?: number; reps: number; weight?: number };

/**
 * A ready-made workout ("treino pronto"). Running one starts a session with no
 * routine; it only becomes a routine if the user saves it when finishing (ADR 0023).
 */
export type ReadyWorkout = { key: string; name: string; subtitle: string; blocks: BlockDraft[] };

function exercises(items: ReadyItem[]): BlockDraft {
  return {
    ...emptyBlock('exercises'),
    items: items.map(({ slug, sets = 3, reps }) => ({
      ...emptyItem(`seed-${slug}`, 'exercises'),
      sets: Array.from({ length: sets }, () => newSet('normal', { reps })),
    })),
  };
}

function wod(kind: WodKind, config: Partial<BlockConfig>, items: ReadyItem[], notes: string | null = null): BlockDraft {
  return {
    ...emptyBlock(kind),
    ...defaultBlockConfig(kind),
    ...config,
    notes,
    items: items.map(({ slug, reps, weight }) => ({ ...emptyItem(`seed-${slug}`, kind), reps, weight: weight ?? null })),
  };
}

/** Ready-made workouts offered on first use and in the Treinos tab. */
export const READY_WORKOUTS: ReadyWorkout[] = [
  {
    key: 'abc-a',
    name: 'Treino A · Peito e tríceps',
    subtitle: 'Musculação · 5 exercícios',
    blocks: [exercises([
      { slug: 'bench-press', reps: 10 },
      { slug: 'incline-bench-press', reps: 10 },
      { slug: 'chest-fly', reps: 12 },
      { slug: 'triceps-pushdown', reps: 12 },
      { slug: 'skull-crusher', reps: 10 },
    ])],
  },
  {
    key: 'abc-b',
    name: 'Treino B · Costas e bíceps',
    subtitle: 'Musculação · 5 exercícios',
    blocks: [exercises([
      { slug: 'lat-pulldown', reps: 10 },
      { slug: 'barbell-row', reps: 10 },
      { slug: 'seated-row', reps: 12 },
      { slug: 'barbell-curl', reps: 10 },
      { slug: 'hammer-curl', reps: 12 },
    ])],
  },
  {
    key: 'abc-c',
    name: 'Treino C · Pernas e ombros',
    subtitle: 'Musculação · 5 exercícios',
    blocks: [exercises([
      { slug: 'back-squat', reps: 10 },
      { slug: 'leg-press', reps: 12 },
      { slug: 'leg-curl', reps: 12 },
      { slug: 'overhead-press', reps: 10 },
      { slug: 'lateral-raise', reps: 15 },
    ])],
  },
  {
    key: 'full-body',
    name: 'Full body',
    subtitle: 'Musculação · 5 exercícios',
    blocks: [exercises([
      { slug: 'back-squat', reps: 8 },
      { slug: 'bench-press', reps: 8 },
      { slug: 'barbell-row', reps: 8 },
      { slug: 'overhead-press', reps: 10 },
      { slug: 'romanian-deadlift', reps: 10 },
    ])],
  },
  {
    key: 'fran',
    name: 'Fran',
    subtitle: 'For Time · 21-15-9',
    blocks: [
      wod(
        'for_time',
        { rounds: 1, timeCapSec: 10 * 60 },
        [
          { slug: 'thruster', reps: 45, weight: 43 },
          { slug: 'pull-up', reps: 45 },
        ],
        '21-15-9 de thruster e barra fixa.',
      ),
    ],
  },
  {
    key: 'cindy',
    name: 'Cindy',
    subtitle: 'AMRAP · 20 min',
    blocks: [
      wod('amrap', { durationSec: 20 * 60 }, [
        { slug: 'pull-up', reps: 5 },
        { slug: 'push-up', reps: 10 },
        { slug: 'air-squat', reps: 15 },
      ]),
    ],
  },
];

/** Whether the ready workout is strength training (its subtitle is shown muted instead of in the WOD color). */
export const isStrength = (w: ReadyWorkout) => w.blocks.some((b) => b.kind === 'exercises');
