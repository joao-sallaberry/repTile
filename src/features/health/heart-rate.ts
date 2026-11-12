export type HeartRatePoint = { time: number; bpm: number };

export type HeartRateSummary = {
  avg: number;
  max: number;
  min: number;
  /** Average bpm of each minute from `start` (null = no reading that minute). */
  perMinute: (number | null)[];
};

const MINUTE = 60_000;

/** Heart rate within [start, end): average, max, min and a per-minute series. `null` without readings. */
export function summarizeHeartRate(
  samples: readonly HeartRatePoint[],
  start: number,
  end: number,
): HeartRateSummary | null {
  const inRange = samples.filter((s) => s.time >= start && s.time < end && s.bpm > 0);
  if (inRange.length === 0) return null;

  const minutes = Math.max(1, Math.ceil((end - start) / MINUTE));
  const sums = new Array<number>(minutes).fill(0);
  const counts = new Array<number>(minutes).fill(0);
  let total = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const s of inRange) {
    const i = Math.min(minutes - 1, Math.floor((s.time - start) / MINUTE));
    sums[i] += s.bpm;
    counts[i] += 1;
    total += s.bpm;
    max = Math.max(max, s.bpm);
    min = Math.min(min, s.bpm);
  }
  return {
    avg: Math.round(total / inRange.length),
    max: Math.round(max),
    min: Math.round(min),
    perMinute: sums.map((sum, i) => (counts[i] ? Math.round(sum / counts[i]) : null)),
  };
}
