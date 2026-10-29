import { moveToDay, normalizeTimes, stepRest } from './times';

const at = (h: number, m = 0, day = 17) => new Date(2026, 9, day, h, m).getTime();

describe('normalizeTimes', () => {
  it('keeps a normal range', () => {
    expect(normalizeTimes(at(18, 40), at(19, 35))).toEqual({ start: at(18, 40), end: at(19, 35) });
  });

  it('moves an end before the start to the next day (past midnight)', () => {
    expect(normalizeTimes(at(23, 30), at(0, 20))).toEqual({ start: at(23, 30), end: at(0, 20, 18) });
  });

  it('pulls an end more than a day later back', () => {
    expect(normalizeTimes(at(18), at(19, 0, 19))).toEqual({ start: at(18), end: at(19) });
  });
});

describe('moveToDay', () => {
  it('keeps the start time and the duration', () => {
    expect(moveToDay({ start: at(18, 40), end: at(19, 35) }, at(9, 0, 14))).toEqual({ start: at(18, 40, 14), end: at(19, 35, 14) });
  });

  it('keeps a workout that ends past midnight ending the next day', () => {
    expect(moveToDay({ start: at(23, 30), end: at(0, 20, 18) }, at(12, 0, 3))).toEqual({ start: at(23, 30, 3), end: at(0, 20, 4) });
  });
});

describe('stepRest', () => {
  it('steps by 15 s', () => {
    expect(stepRest(90, 15)).toBe(105);
    expect(stepRest(90, -15)).toBe(75);
  });

  it('snaps an off-grid value to the grid first', () => {
    expect(stepRest(100, 15)).toBe(105);
    expect(stepRest(100, -15)).toBe(90);
  });

  it('stays between 0 and 15 min', () => {
    expect(stepRest(0, -15)).toBe(0);
    expect(stepRest(900, 15)).toBe(900);
  });
});
