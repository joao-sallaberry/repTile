import { addMonths, groupByWeek, monthBounds, monthGrid, weekTitle } from './calendar';

// Monday, 19 Oct 2026, 15:00 local time
const now = new Date(2026, 9, 19, 15).getTime();
const at = (month: number, day: number, hour = 10) => new Date(2026, month, day, hour).getTime();

describe('monthGrid', () => {
  it('starts on Monday and pads both ends', () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    const rows = monthGrid({ year: 2026, month: 9 }, [], now);
    expect(rows).toHaveLength(5);
    expect(rows[0].slice(0, 3)).toEqual([null, null, null]);
    expect(rows[0][3]?.day).toBe(1);
    expect(rows[4][5]?.day).toBe(31);
    expect(rows[4][6]).toBeNull();
  });

  it('marks trained days, records, today and the future', () => {
    const rows = monthGrid(
      { year: 2026, month: 9 },
      [
        { startedAt: at(9, 15), prs: 2 },
        { startedAt: at(9, 14), prs: 0 },
        { startedAt: at(8, 30), prs: 1 },
      ],
      now,
    );
    const cell = (day: number) => rows.flat().find((c) => c?.day === day)!;
    expect(cell(15)).toEqual({ day: 15, state: 'done', pr: true });
    expect(cell(14)).toEqual({ day: 14, state: 'done', pr: false });
    expect(cell(13).state).toBe('past');
    expect(cell(19).state).toBe('today');
    expect(cell(20).state).toBe('future');
  });

  it('a past month has no today', () => {
    const rows = monthGrid({ year: 2026, month: 8 }, [], now);
    expect(rows.flat().every((c) => !c || c.state === 'past')).toBe(true);
  });
});

describe('months', () => {
  it('addMonths crosses years', () => {
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('monthBounds spans the whole month', () => {
    const { start, end } = monthBounds({ year: 2026, month: 9 });
    expect(new Date(start)).toEqual(new Date(2026, 9, 1));
    expect(new Date(end)).toEqual(new Date(2026, 10, 1));
  });
});

describe('weekTitle', () => {
  it('names the current and the last week', () => {
    expect(weekTitle(new Date(2026, 9, 19).getTime(), now)).toBe('Esta semana');
    expect(weekTitle(new Date(2026, 9, 12).getTime(), now)).toBe('Semana passada');
  });

  it('shows the range of older weeks', () => {
    expect(weekTitle(new Date(2026, 9, 5).getTime(), now)).toBe('5 a 11 out');
    expect(weekTitle(new Date(2026, 8, 28).getTime(), now)).toBe('28 set a 4 out');
    expect(weekTitle(new Date(2025, 11, 29).getTime(), now)).toBe('29 dez a 4 jan');
    expect(weekTitle(new Date(2025, 11, 22).getTime(), now)).toBe('22 a 28 dez de 2025');
  });
});

describe('groupByWeek', () => {
  it('groups newest-first sessions by Monday-based week', () => {
    const groups = groupByWeek([{ startedAt: at(9, 19) }, { startedAt: at(9, 18) }, { startedAt: at(9, 12) }, { startedAt: at(9, 11) }], now);
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([
      ['Esta semana', 1],
      ['Semana passada', 2],
      ['5 a 11 out', 1],
    ]);
  });
});
