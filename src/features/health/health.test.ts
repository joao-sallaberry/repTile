import { summarizeHeartRate } from './heart-rate';
import { autoLinkMessage, bestMatch, exerciseName, exerciseTypeLabel, healthLine, sourceLabel } from './match';

const min = (m: number) => m * 60_000;
const ex = (id: string, start: number, end: number) => ({
  id,
  start: min(start),
  end: min(end),
  exerciseType: 70,
  title: null,
  source: null,
});

describe('bestMatch', () => {
  const session = { start: min(0), end: min(60) };

  it('picks the record with the largest overlap', () => {
    const a = ex('a', -10, 30);
    const b = ex('b', 5, 65);
    expect(bestMatch(session, [a, b])?.id).toBe('b');
  });

  it('accepts a short record fully inside the session', () => {
    expect(bestMatch(session, [ex('a', 20, 35)])?.id).toBe('a');
  });

  it('accepts a long record covering the whole session', () => {
    expect(bestMatch(session, [ex('a', -60, 120)])?.id).toBe('a');
  });

  it('rejects records overlapping less than half of the shorter one', () => {
    expect(bestMatch(session, [ex('a', 50, 90)])).toBeUndefined();
    expect(bestMatch(session, [ex('a', 70, 90)])).toBeUndefined();
  });

  it('ignores empty records', () => {
    expect(bestMatch(session, [ex('a', 10, 10)])).toBeUndefined();
  });
});

describe('summarizeHeartRate', () => {
  it('returns null without readings in range', () => {
    expect(summarizeHeartRate([{ time: min(70), bpm: 100 }], min(0), min(60))).toBeNull();
    expect(summarizeHeartRate([], 0, min(10))).toBeNull();
  });

  it('averages, keeps extremes and buckets per minute', () => {
    const samples = [
      { time: min(0) + 1000, bpm: 90 },
      { time: min(0) + 30_000, bpm: 110 },
      { time: min(2) + 5000, bpm: 150 },
      { time: min(5), bpm: 200 }, // outside [0, 3min)
    ];
    expect(summarizeHeartRate(samples, min(0), min(3))).toEqual({
      avg: 117,
      max: 150,
      min: 90,
      perMinute: [100, null, 150],
    });
  });
});

describe('autoLinkMessage', () => {
  it('tells apart nothing to link, an empty Health Connect, no overlap and partial links', () => {
    expect(autoLinkMessage({ pending: 0, records: 0, linked: 0, refreshed: 0 })).toMatch(/já estão vinculados/);
    expect(autoLinkMessage({ pending: 3, records: 0, linked: 0, refreshed: 0 })).toMatch(/^Nenhum exercício do relógio no Health Connect/);
    expect(autoLinkMessage({ pending: 3, records: 2, linked: 0, refreshed: 0 })).toBe('Nenhum exercício do relógio no mesmo horário dos treinos');
    expect(autoLinkMessage({ pending: 1, records: 1, linked: 1, refreshed: 0 })).toBe('1 treino vinculado');
    expect(autoLinkMessage({ pending: 3, records: 4, linked: 2, refreshed: 0 })).toBe('2 treinos vinculados; 1 sem exercício no mesmo horário');
    expect(autoLinkMessage({ pending: 0, records: 0, linked: 0, refreshed: 2 })).toBe('2 treinos receberam a frequência cardíaca');
    expect(autoLinkMessage({ pending: 1, records: 1, linked: 1, refreshed: 1 })).toBe(
      '1 treino vinculado; 1 treino recebeu a frequência cardíaca',
    );
  });
});

describe('labels', () => {
  it('names types and sources', () => {
    expect(exerciseTypeLabel(70)).toBe('Musculação');
    expect(exerciseTypeLabel(999)).toBe('Exercício');
    expect(exerciseTypeLabel(null)).toBe('Exercício');
    expect(sourceLabel('com.fitbit.FitbitMobile')).toBe('Google Health');
    expect(sourceLabel(null)).toBeNull();
    expect(exerciseName({ title: '  ', exerciseType: 36 })).toBe('HIIT');
    expect(exerciseName({ title: 'Peito', exerciseType: 36 })).toBe('Peito');
  });
});

describe('healthLine', () => {
  it('shows heart rate and calories, or the source without them', () => {
    expect(healthLine({ avgHr: 95, calories: 215 })).toBe('95 bpm · 215 kcal');
    expect(healthLine({ avgHr: null, calories: 215 })).toBe('215 kcal');
    expect(healthLine({ avgHr: null, calories: null })).toBe('Google Health');
  });
});
