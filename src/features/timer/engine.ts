/**
 * Pure timer engine (no React, no clock of its own).
 *
 * All state is derived from timestamps: given when the timer started, how long
 * it was paused and "now", we compute the phase, displayed time and round.
 * This keeps the timer correct even if JS is suspended in the background.
 */

export type TimerSpec =
  | { kind: 'rest'; durationSec: number }
  | { kind: 'amrap'; durationSec: number }
  | { kind: 'emom'; intervalSec: number; rounds: number }
  | { kind: 'for_time'; timeCapSec: number | null };

export type TimerClock = {
  /** When (ms) the timer was started, including the lead-in countdown. */
  startedAt: number;
  /** Countdown seconds ("3, 2, 1, go!") before work starts. */
  leadInSec: number;
  /** When (ms) it was paused, or null while running. */
  pausedAt: number | null;
  /** Total (ms) spent in previous pauses. */
  pausedTotalMs: number;
  /** Seconds added to the timer (e.g. "+30s" on a rest). */
  extraSec: number;
};

export type TimerPhase = 'lead_in' | 'running' | 'done';

export type TimerSnapshot = {
  phase: TimerPhase;
  /** Elapsed work seconds (0 during the lead-in). */
  elapsedSec: number;
  /** Main value to display, in seconds. */
  displaySec: number;
  direction: 'up' | 'down';
  /** Total work duration, or null when unbounded (For Time without a cap). */
  totalSec: number | null;
  /** 0..1, or null when there is no total duration. */
  progress: number | null;
  /** EMOM: current interval (1-based). */
  round: number | null;
  roundCount: number | null;
  /** EMOM: seconds left in the current interval. */
  roundRemainingSec: number | null;
};

export type CueKind = 'tick' | 'go' | 'interval' | 'end';
/** An audio cue `atSec` seconds after `startedAt` (lead-in included). */
export type Cue = { atSec: number; kind: CueKind };

export function totalWorkSec(spec: TimerSpec, extraSec = 0): number | null {
  switch (spec.kind) {
    case 'rest':
    case 'amrap':
      return spec.durationSec + extraSec;
    case 'emom':
      return spec.intervalSec * spec.rounds + extraSec;
    case 'for_time':
      return spec.timeCapSec == null ? null : spec.timeCapSec + extraSec;
  }
}

/** Milliseconds actually run since `startedAt`, excluding pauses. */
export function runningMs(clock: TimerClock, now: number): number {
  const end = clock.pausedAt ?? now;
  return Math.max(0, end - clock.startedAt - clock.pausedTotalMs);
}

export function computeTimer(spec: TimerSpec, clock: TimerClock, now: number): TimerSnapshot {
  const total = totalWorkSec(spec, clock.extraSec);
  const sinceStart = runningMs(clock, now) / 1000;
  const elapsed = Math.max(0, sinceStart - clock.leadInSec);

  const base = {
    totalSec: total,
    round: null,
    roundCount: null,
    roundRemainingSec: null,
  };

  if (sinceStart < clock.leadInSec) {
    return {
      ...base,
      phase: 'lead_in',
      elapsedSec: 0,
      displaySec: Math.ceil(clock.leadInSec - sinceStart),
      direction: 'down',
      progress: total == null ? null : 0,
    };
  }

  const done = total != null && elapsed >= total;
  const clamped = total == null ? elapsed : Math.min(elapsed, total);
  const phase: TimerPhase = done ? 'done' : 'running';
  const progress = total == null ? null : total === 0 ? 1 : clamped / total;

  if (spec.kind === 'emom') {
    const intervalCount = Math.max(1, spec.rounds);
    const idx = Math.min(Math.floor(clamped / spec.intervalSec), intervalCount - 1);
    const roundEnd = (idx + 1) * spec.intervalSec;
    return {
      ...base,
      phase,
      elapsedSec: clamped,
      displaySec: Math.ceil(Math.max(0, roundEnd - clamped)),
      direction: 'down',
      progress,
      round: idx + 1,
      roundCount: intervalCount,
      roundRemainingSec: Math.ceil(Math.max(0, roundEnd - clamped)),
    };
  }

  if (spec.kind === 'for_time') {
    return { ...base, phase, elapsedSec: clamped, displaySec: Math.floor(clamped), direction: 'up', progress };
  }

  // rest / amrap: count down
  return {
    ...base,
    phase,
    elapsedSec: clamped,
    displaySec: Math.ceil(Math.max(0, (total ?? 0) - clamped)),
    direction: 'down',
    progress,
  };
}

function countdownTicks(endSec: number, minSec: number): Cue[] {
  const cues: Cue[] = [];
  for (let s = 3; s >= 1; s--) {
    const at = endSec - s;
    if (at >= minSec) cues.push({ atSec: at, kind: 'tick' });
  }
  return cues;
}

/** All of the timer's audio cues, in chronological order. */
export function timerCues(spec: TimerSpec, clock: Pick<TimerClock, 'leadInSec' | 'extraSec'>): Cue[] {
  const lead = clock.leadInSec;
  const cues: Cue[] = [];
  if (lead > 0) {
    cues.push(...countdownTicks(lead, 0));
    cues.push({ atSec: lead, kind: 'go' });
  }

  if (spec.kind === 'emom') {
    for (let i = 1; i < spec.rounds; i++) {
      const at = lead + i * spec.intervalSec;
      cues.push(...countdownTicks(at, lead + (i - 1) * spec.intervalSec + 1));
      cues.push({ atSec: at, kind: 'interval' });
    }
  }

  const total = totalWorkSec(spec, clock.extraSec);
  if (total != null) {
    const end = lead + total;
    const lastSegmentStart =
      spec.kind === 'emom' ? lead + (spec.rounds - 1) * spec.intervalSec + 1 : lead + 1;
    cues.push(...countdownTicks(end, lastSegmentStart));
    cues.push({ atSec: end, kind: 'end' });
  }
  return cues;
}

/** Absolute time (ms) when the timer ends, or null if unbounded or paused. */
export function endsAt(spec: TimerSpec, clock: TimerClock): number | null {
  const total = totalWorkSec(spec, clock.extraSec);
  if (total == null || clock.pausedAt != null) return null;
  return clock.startedAt + clock.pausedTotalMs + (clock.leadInSec + total) * 1000;
}

/** Absolute time (ms) when work starts (end of the lead-in). */
export function workStartsAt(clock: TimerClock): number {
  return clock.startedAt + clock.pausedTotalMs + clock.leadInSec * 1000;
}

export function newClock(now: number, leadInSec: number): TimerClock {
  return { startedAt: now, leadInSec, pausedAt: null, pausedTotalMs: 0, extraSec: 0 };
}

export function pause(clock: TimerClock, now: number): TimerClock {
  return clock.pausedAt != null ? clock : { ...clock, pausedAt: now };
}

export function resume(clock: TimerClock, now: number): TimerClock {
  if (clock.pausedAt == null) return clock;
  return { ...clock, pausedAt: null, pausedTotalMs: clock.pausedTotalMs + (now - clock.pausedAt) };
}

export function addSeconds(clock: TimerClock, sec: number): TimerClock {
  return { ...clock, extraSec: clock.extraSec + sec };
}
