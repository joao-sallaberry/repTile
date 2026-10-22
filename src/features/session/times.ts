const DAY_MS = 24 * 3600 * 1000;

/** Keeps the end after the start and within a day of it (a picked time keeps its original day). */
export function normalizeTimes(start: number, end: number) {
  while (end <= start) end += DAY_MS;
  while (end - start > DAY_MS) end -= DAY_MS;
  return { start, end };
}
