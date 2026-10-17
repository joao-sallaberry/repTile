import type { SetType } from '@/db/schema';
import { countsTowardStats } from '@/features/session/sets';

const DAY_MS = 24 * 3600 * 1000;
/** Monday first. */
const WEEKDAY_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The current week in local time, Monday 00:00 to next Monday 00:00. */
export function weekBounds(now: number): { start: number; end: number } {
  const d = new Date(startOfDay(now));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const start = d.getTime();
  d.setDate(d.getDate() + 7);
  return { start, end: d.getTime() };
}

export type WeekDay = { label: string; dayOfMonth: number; state: 'done' | 'today' | 'empty' };

/** Monday..Sunday of the current week; a day is `done` if any session started on it. */
export function weekDays(sessionStarts: number[], now: number): WeekDay[] {
  const trained = new Set(sessionStarts.map(startOfDay));
  const today = startOfDay(now);
  const d = new Date(weekBounds(now).start);
  return WEEKDAY_LETTERS.map((label) => {
    const day = d.getTime();
    const dayOfMonth = d.getDate();
    d.setDate(d.getDate() + 1);
    return { label, dayOfMonth, state: trained.has(day) ? 'done' : day === today ? 'today' : 'empty' };
  });
}

/** Whole calendar days between two instants (DST-safe). */
export function daysBetween(from: number, to: number): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/** "hoje", "ontem", "há 4 dias", "há 2 semanas", "há 3 meses"; `null` = "nunca feito". */
export function relativeDays(ts: number | null | undefined, now: number): string {
  if (ts == null) return 'nunca feito';
  const n = daysBetween(ts, now);
  if (n <= 0) return 'hoje';
  if (n === 1) return 'ontem';
  if (n < 7) return `há ${n} dias`;
  if (n < 14) return 'há 1 semana';
  if (n < 60) return `há ${Math.floor(n / 7)} semanas`;
  const months = Math.floor(n / 30);
  return months < 12 ? `há ${months} meses` : months < 24 ? 'há 1 ano' : `há ${Math.floor(months / 12)} anos`;
}

/**
 * The routine to suggest next: one never done (oldest first), else the one done
 * longest ago. Doing A, B, C in turn makes this the next one in the rotation.
 */
export function nextInRotation<T extends { id: string; createdAt: number }>(
  routines: T[],
  lastDoneById: Map<string, number>,
): T | null {
  let best: T | null = null;
  const key = (r: T) => lastDoneById.get(r.id) ?? -Infinity;
  for (const r of routines) {
    if (!best || key(r) < key(best) || (key(r) === key(best) && r.createdAt < best.createdAt)) best = r;
  }
  return best;
}

export type StatSet = { type: SetType; weight: number | null; reps: number | null; completedAt: number | null };

/** Volume (kg) and number of completed working sets; warm-ups don't count. */
export function summarizeSets(sets: StatSet[]): { volume: number; sets: number } {
  let volume = 0;
  let count = 0;
  for (const s of sets) {
    if (!s.completedAt || !countsTowardStats(s.type)) continue;
    count++;
    volume += (s.weight ?? 0) * (s.reps ?? 0);
  }
  return { volume, sets: count };
}

/** 3480 -> "58 min"; 3840 -> "1h04". */
export function formatMinutes(totalSec: number): string {
  const min = Math.max(0, Math.round(totalSec / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

/** 6840 -> "6.840 kg"; 18240 -> "18,2 t". */
export function formatVolume(kg: number): string {
  if (kg >= 10_000) return `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t`;
  return `${Math.round(kg).toLocaleString('pt-BR')} kg`;
}
