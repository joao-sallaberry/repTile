import { activityNames, importMessage, isPickedActivity, recordsToImport, supersededImports } from './import';

const min = (m: number) => m * 60_000;
const rec = (id: string, start: number, end: number, title: string | null = 'CrossFit', exerciseType = 36) => ({
  id,
  start: min(start),
  end: min(end),
  exerciseType,
  title,
  source: 'com.fitbit.FitbitMobile',
});
const span = (start: number, end: number | null) => ({ start: min(start), end: end == null ? null : min(end) });
const opts = (o: Partial<Parameters<typeof recordsToImport>[1]> = {}) => ({
  picked: ['CrossFit'],
  knownRecordIds: new Set<string>(),
  appSessions: [],
  now: min(1000),
  ...o,
});

describe('isPickedActivity', () => {
  it('matches the display name, ignoring case and spaces', () => {
    expect(isPickedActivity(rec('a', 0, 60, ' crossfit '), ['CrossFit'])).toBe(true);
    expect(isPickedActivity(rec('a', 0, 60, 'Corrida'), ['CrossFit'])).toBe(false);
  });

  it('falls back to the exercise type label without a title', () => {
    expect(isPickedActivity(rec('a', 0, 60, null, 70), ['Musculação'])).toBe(true);
  });
});

describe('recordsToImport', () => {
  it('imports records of picked activities only', () => {
    const list = [rec('a', 0, 60), rec('b', 100, 130, 'Caminhada', 79)];
    expect(recordsToImport(list, opts()).map((r) => r.id)).toEqual(['a']);
  });

  it('imports nothing without picked activities', () => {
    expect(recordsToImport([rec('a', 0, 60)], opts({ picked: [] }))).toEqual([]);
  });

  it('skips records already linked or imported', () => {
    expect(recordsToImport([rec('a', 0, 60)], opts({ knownRecordIds: new Set(['a']) }))).toEqual([]);
  });

  it('skips records at the same time as a workout of the app, even partly', () => {
    expect(recordsToImport([rec('a', 0, 60)], opts({ appSessions: [span(50, 120)] }))).toEqual([]);
    expect(recordsToImport([rec('a', 0, 60)], opts({ appSessions: [span(60, 120)] })).map((r) => r.id)).toEqual(['a']);
  });

  it('skips records overlapping a workout still in progress', () => {
    expect(recordsToImport([rec('a', 0, 60)], opts({ appSessions: [span(30, null)], now: min(40) }))).toEqual([]);
  });

  it('imports only records longer than a minute', () => {
    expect(recordsToImport([rec('a', 10, 10), rec('b', 10, 11)], opts())).toEqual([]);
    const longer = { ...rec('c', 10, 11), end: min(11) + 1000 };
    expect(recordsToImport([longer], opts()).map((r) => r.id)).toEqual(['c']);
  });
});

describe('supersededImports', () => {
  const imported = [{ id: 's1', start: min(0), end: min(60) }, { id: 's2', start: min(200), end: min(260) }];

  it('returns the imports a workout of the app now covers', () => {
    expect(supersededImports(imported, [span(10, 70)], min(1000)).map((s) => s.id)).toEqual(['s1']);
    expect(supersededImports(imported, [span(100, 150)], min(1000))).toEqual([]);
  });
});

describe('activityNames', () => {
  it('groups records by name, most frequent first', () => {
    const list = [rec('a', 0, 1), rec('b', 0, 1, 'Corrida'), rec('c', 0, 1, 'crossfit'), rec('d', 0, 1, null, 70)];
    expect(activityNames(list)).toEqual([
      { name: 'CrossFit', count: 2 },
      { name: 'Corrida', count: 1 },
      { name: 'Musculação', count: 1 },
    ]);
  });
});

describe('importMessage', () => {
  it('says how many were imported and replaced', () => {
    expect(importMessage({ imported: 0, removed: 0 })).toBe('Nenhuma atividade nova');
    expect(importMessage({ imported: 1, removed: 0 })).toBe('1 atividade importada');
    expect(importMessage({ imported: 3, removed: 1 })).toBe('3 atividades importadas; 1 substituída por um treino do app');
  });
});
