const DAY_MS = 24 * 3600 * 1000;

/** Keeps the end after the start and within a day of it (a picked time keeps its original day). */
export function normalizeTimes(start: number, end: number) {
  while (end <= start) end += DAY_MS;
  while (end - start > DAY_MS) end -= DAY_MS;
  return { start, end };
}

/** Moves a workout to the day of `day`, keeping its start time and duration (DST-safe). */
export function moveToDay(times: { start: number; end: number }, day: number) {
  const d = new Date(day);
  const start = new Date(times.start);
  start.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
  return { start: start.getTime(), end: start.getTime() + (times.end - times.start) };
}

export const REST_STEP = 15;
const REST_MAX = 15 * 60;

/** Rest after a −/+ press: snapped to the 15 s grid, between 0 and 15 min (90 → 105, 100 − 15 → 90). */
export function stepRest(sec: number, delta: number): number {
  const snapped = delta > 0 ? Math.floor(sec / REST_STEP) * REST_STEP : Math.ceil(sec / REST_STEP) * REST_STEP;
  return Math.min(REST_MAX, Math.max(0, snapped + delta));
}
