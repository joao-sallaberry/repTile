/** Estimated 1RM using the Epley formula. */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export type PerformedSet = {
  sessionId: string;
  completedAt: number;
  weight: number | null;
  reps: number | null;
};

export type ExercisePRs = {
  maxWeight: { value: number; reps: number; at: number } | null;
  bestOneRepMax: { value: number; at: number } | null;
  maxReps: { value: number; at: number } | null;
  bestSessionVolume: { value: number; sessionId: string; at: number } | null;
};

/** Computes an exercise's PRs from its completed sets. */
export function computePRs(sets: PerformedSet[]): ExercisePRs {
  const prs: ExercisePRs = { maxWeight: null, bestOneRepMax: null, maxReps: null, bestSessionVolume: null };
  const volumeBySession = new Map<string, { value: number; at: number }>();

  for (const s of sets) {
    const reps = s.reps ?? 0;
    const weight = s.weight ?? 0;
    if (reps <= 0) continue;

    if (weight > 0 && (!prs.maxWeight || weight > prs.maxWeight.value ||
        (weight === prs.maxWeight.value && reps > prs.maxWeight.reps))) {
      prs.maxWeight = { value: weight, reps, at: s.completedAt };
    }
    const orm = estimateOneRepMax(weight, reps);
    if (orm > 0 && (!prs.bestOneRepMax || orm > prs.bestOneRepMax.value)) {
      prs.bestOneRepMax = { value: orm, at: s.completedAt };
    }
    if (!prs.maxReps || reps > prs.maxReps.value) {
      prs.maxReps = { value: reps, at: s.completedAt };
    }
    const v = volumeBySession.get(s.sessionId);
    volumeBySession.set(s.sessionId, {
      value: (v?.value ?? 0) + weight * reps,
      at: Math.max(v?.at ?? 0, s.completedAt),
    });
  }

  for (const [sessionId, v] of volumeBySession) {
    if (v.value > 0 && (!prs.bestSessionVolume || v.value > prs.bestSessionVolume.value)) {
      prs.bestSessionVolume = { ...v, sessionId };
    }
  }
  return prs;
}

/**
 * Whether `set` beats the weight or estimated-1RM record of the previous sets
 * (used to show the "new PR" badge when a set is completed).
 */
export function isNewPR(previous: PerformedSet[], set: PerformedSet): boolean {
  if (!set.reps || !set.weight) return false;
  const before = computePRs(previous);
  if (!before.maxWeight) return previous.length > 0;
  return (
    set.weight > before.maxWeight.value ||
    estimateOneRepMax(set.weight, set.reps) > (before.bestOneRepMax?.value ?? 0) + 1e-9
  );
}

export type WodResult = { resultTimeSec: number | null; resultRounds: number | null; resultReps: number | null };

/** Compares WOD results: For Time = lowest time; AMRAP = most rounds/reps. */
export function compareWodResults(type: 'amrap' | 'for_time' | 'emom', a: WodResult, b: WodResult): number {
  if (type === 'for_time') {
    // finishing within the cap (with a time) beats not finishing (rounds/reps)
    if (a.resultTimeSec != null && b.resultTimeSec != null) return b.resultTimeSec - a.resultTimeSec;
    if (a.resultTimeSec != null) return 1;
    if (b.resultTimeSec != null) return -1;
  }
  const score = (r: WodResult) => (r.resultRounds ?? 0) * 10_000 + (r.resultReps ?? 0);
  return score(a) - score(b);
}

/** Whether a WOD result beats every earlier result of the same routine (never on the first time). */
export function isWodPR(type: 'amrap' | 'for_time' | 'emom', result: WodResult, previous: WodResult[]): boolean {
  if (type === 'emom' || !previous.length) return false;
  return previous.every((p) => compareWodResults(type, result, p) > 0);
}
