import { emptyItem, emptyWorkout, newSet, saveWorkout, type WorkoutDraft } from './repo';

type TemplateItem = { slug: string; sets?: number; reps: number; weight?: number };

export type WorkoutTemplate = { key: string; name: string; subtitle: string; routines: WorkoutDraft[] };

function strength(name: string, items: TemplateItem[]): WorkoutDraft {
  return {
    ...emptyWorkout('strength'),
    name,
    items: items.map(({ slug, sets = 3, reps }) => ({
      ...emptyItem(`seed-${slug}`, 'strength'),
      sets: Array.from({ length: sets }, () => newSet('normal', { reps })),
    })),
  };
}

function wod(base: Partial<WorkoutDraft> & Pick<WorkoutDraft, 'name' | 'type'>, items: TemplateItem[]): WorkoutDraft {
  return {
    ...emptyWorkout(base.type),
    ...base,
    items: items.map(({ slug, reps, weight }) => ({ ...emptyItem(`seed-${slug}`, base.type), reps, weight: weight ?? null })),
  };
}

/** Ready-made routines offered on first use; copied into the user's routines when picked. */
export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    key: 'abc',
    name: 'ABC clássico',
    subtitle: 'Musculação · 3 rotinas',
    routines: [
      strength('Treino A · Peito e tríceps', [
        { slug: 'bench-press', reps: 10 },
        { slug: 'incline-bench-press', reps: 10 },
        { slug: 'chest-fly', reps: 12 },
        { slug: 'triceps-pushdown', reps: 12 },
        { slug: 'skull-crusher', reps: 10 },
      ]),
      strength('Treino B · Costas e bíceps', [
        { slug: 'lat-pulldown', reps: 10 },
        { slug: 'barbell-row', reps: 10 },
        { slug: 'seated-row', reps: 12 },
        { slug: 'barbell-curl', reps: 10 },
        { slug: 'hammer-curl', reps: 12 },
      ]),
      strength('Treino C · Pernas e ombros', [
        { slug: 'back-squat', reps: 10 },
        { slug: 'leg-press', reps: 12 },
        { slug: 'leg-curl', reps: 12 },
        { slug: 'overhead-press', reps: 10 },
        { slug: 'lateral-raise', reps: 15 },
      ]),
    ],
  },
  {
    key: 'full-body',
    name: 'Full body',
    subtitle: 'Musculação · 1 rotina',
    routines: [
      strength('Full body', [
        { slug: 'back-squat', reps: 8 },
        { slug: 'bench-press', reps: 8 },
        { slug: 'barbell-row', reps: 8 },
        { slug: 'overhead-press', reps: 10 },
        { slug: 'romanian-deadlift', reps: 10 },
      ]),
    ],
  },
  {
    key: 'fran',
    name: 'Fran',
    subtitle: 'For Time · 21-15-9',
    routines: [
      wod({ name: 'Fran', type: 'for_time', rounds: 1, timeCapSec: 10 * 60, notes: '21-15-9 de thruster e barra fixa.' }, [
        { slug: 'thruster', reps: 45, weight: 43 },
        { slug: 'pull-up', reps: 45 },
      ]),
    ],
  },
  {
    key: 'cindy',
    name: 'Cindy',
    subtitle: 'AMRAP · 20 min',
    routines: [
      wod({ name: 'Cindy', type: 'amrap', durationSec: 20 * 60 }, [
        { slug: 'pull-up', reps: 5 },
        { slug: 'push-up', reps: 10 },
        { slug: 'air-squat', reps: 15 },
      ]),
    ],
  },
];

/** Saves the template's routines. Returns their IDs. */
export async function installTemplate(template: WorkoutTemplate): Promise<string[]> {
  const ids: string[] = [];
  for (const draft of template.routines) ids.push(await saveWorkout(null, draft));
  return ids;
}
