/** A Health Connect exercise record, reduced to what matching and the picker need. */
export type HealthExercise = {
  id: string;
  start: number;
  end: number;
  exerciseType: number;
  title: string | null;
  source: string | null;
};

/** Minimum overlap, as a share of the shorter of the two, for an automatic match. */
const MIN_OVERLAP = 0.5;

const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

/**
 * The exercise record that best matches a session: the largest time overlap, covering at least half of the
 * shorter of the two. `undefined` when none does.
 */
export function bestMatch<T extends HealthExercise>(
  session: { start: number; end: number },
  candidates: readonly T[],
): T | undefined {
  let best: T | undefined;
  let bestOverlap = 0;
  for (const c of candidates) {
    const o = overlap(session.start, session.end, c.start, c.end);
    const shorter = Math.min(session.end - session.start, c.end - c.start);
    if (shorter <= 0 || o / shorter < MIN_OVERLAP) continue;
    if (o > bestOverlap) {
      best = c;
      bestOverlap = o;
    }
  }
  return best;
}

/** pt-BR labels for the Health Connect exercise types a gym/box session is likely to be recorded as. */
const TYPE_LABELS: Record<number, string> = {
  8: 'Bicicleta',
  9: 'Bicicleta ergométrica',
  10: 'Bootcamp',
  13: 'Calistenia',
  25: 'Elíptico',
  36: 'HIIT',
  37: 'Trilha',
  48: 'Pilates',
  54: 'Remo ergômetro',
  56: 'Corrida',
  57: 'Esteira',
  68: 'Escada',
  69: 'Simulador de escada',
  70: 'Musculação',
  71: 'Alongamento',
  74: 'Natação',
  79: 'Caminhada',
  81: 'Levantamento de peso',
  83: 'Yoga',
};

export const exerciseTypeLabel = (type: number | null | undefined) =>
  (type != null && TYPE_LABELS[type]) || 'Exercício';

/** Friendly name of the app that wrote a record. */
export function sourceLabel(pkg: string | null | undefined) {
  if (!pkg) return null;
  if (pkg === 'com.fitbit.FitbitMobile') return 'Google Health';
  if (pkg === 'com.google.android.apps.fitness') return 'Google Fit';
  if (pkg === 'com.google.android.apps.healthdata') return 'Health Connect';
  if (pkg.startsWith('com.samsung')) return 'Samsung Health';
  return pkg;
}

/** Outcome of linking the recent sessions in one go. */
export type AutoLinkResult = {
  /** Finished sessions of the last 30 days that had no link yet. */
  pending: number;
  /** Exercise records found in Health Connect around them. */
  records: number;
  linked: number;
  /** Links saved without heart rate that now have it. */
  refreshed: number;
};

/** Ajustes feedback for "Vincular treinos dos últimos 30 dias": says when Health Connect itself is empty. */
export function autoLinkMessage(result: AutoLinkResult) {
  const main = linkMessage(result);
  const { refreshed } = result;
  if (refreshed === 0) return main;
  const hr = refreshed === 1 ? '1 treino recebeu a frequência cardíaca' : `${refreshed} treinos receberam a frequência cardíaca`;
  return result.pending === 0 ? hr : `${main}; ${hr}`;
}

function linkMessage({ pending, records, linked }: AutoLinkResult) {
  if (pending === 0) return 'Todos os treinos dos últimos 30 dias já estão vinculados';
  if (records === 0) {
    return 'Nenhum exercício do relógio no Health Connect. Permita que o Google Health grave exercícios e frequência cardíaca nele';
  }
  if (linked === 0) return 'Nenhum exercício do relógio no mesmo horário dos treinos';
  const rest = pending - linked;
  const done = linked === 1 ? '1 treino vinculado' : `${linked} treinos vinculados`;
  return rest > 0 ? `${done}; ${rest} sem exercício no mesmo horário` : done;
}

/** Display name of a record: its own title, else the exercise type. */
export const exerciseName = (e: { title: string | null; exerciseType: number | null }) =>
  e.title?.trim() || exerciseTypeLabel(e.exerciseType);

/** "95 bpm · 215 kcal" for a session card linked to Google Health; just the source when neither was recorded. */
export const healthLine = (h: { avgHr: number | null; calories: number | null }) =>
  [h.avgHr ? `${h.avgHr} bpm` : null, h.calories ? `${h.calories} kcal` : null].filter(Boolean).join(' · ') ||
  'Google Health';
