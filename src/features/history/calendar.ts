import { daysBetween, weekBounds } from '@/features/home/stats';

export type Month = { year: number; month: number };

export const monthOf = (ms: number): Month => {
  const d = new Date(ms);
  return { year: d.getFullYear(), month: d.getMonth() };
};

export const addMonths = ({ year, month }: Month, n: number): Month => monthOf(new Date(year, month + n, 1).getTime());

/** Local midnight of the month's first day to the next month's. */
export function monthBounds({ year, month }: Month): { start: number; end: number } {
  return { start: new Date(year, month, 1).getTime(), end: new Date(year, month + 1, 1).getTime() };
}

export type DayCell = { day: number; state: 'done' | 'today' | 'past' | 'future'; pr: boolean };

/**
 * The month as calendar rows, Monday first; `null` pads the first and last weeks.
 * A day is `done` if a session started on it, `pr` if one of them set a record.
 */
export function monthGrid(
  m: Month,
  sessions: { startedAt: number; prs: number }[],
  now: number,
): (DayCell | null)[][] {
  const done = new Set<number>();
  const pr = new Set<number>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (d.getFullYear() !== m.year || d.getMonth() !== m.month) continue;
    done.add(d.getDate());
    if (s.prs > 0) pr.add(d.getDate());
  }
  const today = new Date(now);
  const isCurrent = today.getFullYear() === m.year && today.getMonth() === m.month;
  const afterNow = new Date(m.year, m.month, 1).getTime() > now;
  const lead = (new Date(m.year, m.month, 1).getDay() + 6) % 7;
  const days = new Date(m.year, m.month + 1, 0).getDate();

  const cells: (DayCell | null)[] = Array(lead).fill(null);
  for (let day = 1; day <= days; day++) {
    const state = done.has(day)
      ? 'done'
      : isCurrent && day === today.getDate()
        ? 'today'
        : afterNow || (isCurrent && day > today.getDate())
          ? 'future'
          : 'past';
    cells.push({ day, state, pr: pr.has(day) });
  }
  while (cells.length % 7) cells.push(null);
  const rows: (DayCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

const dayMonthFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const shortMonth = (d: Date) => dayMonthFmt.formatToParts(d).find((p) => p.type === 'month')!.value.replace('.', '');

/** "Esta semana", "Semana passada", "12 a 18 out", "29 set a 5 out" (with the year when it isn't this year's). */
export function weekTitle(start: number, now: number): string {
  const weeksAgo = Math.round(daysBetween(start, weekBounds(now).start) / 7);
  if (weeksAgo === 0) return 'Esta semana';
  if (weeksAgo === 1) return 'Semana passada';
  const first = new Date(start);
  const last = new Date(start);
  last.setDate(last.getDate() + 6);
  const from = first.getMonth() === last.getMonth() ? `${first.getDate()}` : `${first.getDate()} ${shortMonth(first)}`;
  const year = last.getFullYear() !== new Date(now).getFullYear() ? ` de ${last.getFullYear()}` : '';
  return `${from} a ${last.getDate()} ${shortMonth(last)}${year}`;
}

/** Sessions (newest first) grouped by Monday-based week, keeping their order. */
export function groupByWeek<T extends { startedAt: number }>(sessions: T[], now: number) {
  const groups: { key: number; title: string; items: T[] }[] = [];
  for (const s of sessions) {
    const key = weekBounds(s.startedAt).start;
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(s);
    else groups.push({ key, title: weekTitle(key, now), items: [s] });
  }
  return groups;
}
