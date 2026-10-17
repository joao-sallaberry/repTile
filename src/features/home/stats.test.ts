import {
  formatMinutes,
  formatVolume,
  nextInRotation,
  relativeDays,
  summarizeSets,
  weekBounds,
  weekDays,
} from './stats';

// Saturday, 17 Oct 2026, 15:00 local time
const now = new Date(2026, 9, 17, 15, 0).getTime();
const at = (day: number, hour = 10) => new Date(2026, 9, day, hour).getTime();

describe('weekBounds', () => {
  it('starts on Sunday at midnight', () => {
    const { start, end } = weekBounds(now);
    expect(new Date(start)).toEqual(new Date(2026, 9, 11));
    expect(new Date(end)).toEqual(new Date(2026, 9, 18));
  });

  it('a Sunday starts its own week', () => {
    expect(new Date(weekBounds(at(18)).start)).toEqual(new Date(2026, 9, 18));
  });
});

describe('weekDays', () => {
  it('marks trained days and today', () => {
    const days = weekDays([at(12), at(14, 7), at(14, 19), at(15)], now);
    expect(days.map((d) => d.label).join('')).toBe('DSTQQSS');
    expect(days.map((d) => d.dayOfMonth)).toEqual([11, 12, 13, 14, 15, 16, 17]);
    expect(days.map((d) => d.state)).toEqual(['empty', 'done', 'empty', 'done', 'done', 'empty', 'today']);
  });

  it('today counts as done once trained', () => {
    expect(weekDays([at(17, 8)], now)[6].state).toBe('done');
  });
});

describe('relativeDays', () => {
  it('uses calendar days', () => {
    expect(relativeDays(null, now)).toBe('nunca feito');
    expect(relativeDays(at(17, 6), now)).toBe('hoje');
    expect(relativeDays(at(16, 23), now)).toBe('ontem');
    expect(relativeDays(at(13), now)).toBe('há 4 dias');
    expect(relativeDays(at(8), now)).toBe('há 1 semana');
    expect(relativeDays(at(1), now)).toBe('há 2 semanas');
    expect(relativeDays(new Date(2026, 6, 1).getTime(), now)).toBe('há 3 meses');
  });
});

describe('nextInRotation', () => {
  const a = { id: 'a', createdAt: 1 };
  const b = { id: 'b', createdAt: 2 };
  const c = { id: 'c', createdAt: 3 };

  it('suggests the routine done longest ago', () => {
    const last = new Map([
      ['a', at(15)],
      ['b', at(12)],
      ['c', at(14)],
    ]);
    expect(nextInRotation([a, b, c], last)).toBe(b);
  });

  it('prefers routines never done, oldest first', () => {
    expect(nextInRotation([a, b, c], new Map([['a', at(15)]]))).toBe(b);
  });

  it('returns null without routines', () => {
    expect(nextInRotation([], new Map())).toBeNull();
  });
});

describe('summarizeSets', () => {
  it('ignores warm-ups and pending sets', () => {
    expect(
      summarizeSets([
        { type: 'warmup', weight: 40, reps: 10, completedAt: 1 },
        { type: 'normal', weight: 80, reps: 8, completedAt: 2 },
        { type: 'drop', weight: 60, reps: 10, completedAt: 3 },
        { type: 'normal', weight: 80, reps: 8, completedAt: null },
      ]),
    ).toEqual({ volume: 1240, sets: 2 });
  });
});

describe('formatting', () => {
  it('formats durations and volume', () => {
    expect(formatMinutes(3480)).toBe('58 min');
    expect(formatMinutes(3840)).toBe('1h04');
    expect(formatVolume(840)).toBe('840 kg');
    expect(formatVolume(6840)).toBe('6.840 kg');
    expect(formatVolume(18240)).toBe('18,2 t');
  });
});
