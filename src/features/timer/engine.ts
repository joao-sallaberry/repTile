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
  | { kind: 'for_time'; timeCapSec: number | null }
  | { kind: 'tabata'; workSec: number; restSec: number; rounds: number };

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
  /** EMOM: current interval; Tabata: current round (1-based). */
  round: number | null;
  roundCount: number | null;
  /** EMOM: seconds left in the current interval; Tabata: in the current work or rest. */
  roundRemainingSec: number | null;
  /** Tabata: whether it's work or rest time. */
  interval: 'work' | 'rest' | null;
};

/** `interval` = a new EMOM interval or Tabata work; `rest` = Tabata rest starts. */
export type CueKind = 'tick' | 'go' | 'interval' | 'rest' | 'end';
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
    case 'tabata':
      // No rest after the last round.
      return spec.rounds * spec.workSec + Math.max(0, spec.rounds - 1) * spec.restSec + extraSec;
  }
}

/** Tabata: the 0-based round and whether `sec` (work seconds elapsed) falls in work or rest. */
function tabataPosition(spec: Extract<TimerSpec, { kind: 'tabata' }>, sec: number) {
  const cycle = spec.workSec + spec.restSec;
  const idx = Math.min(Math.floor(sec / cycle), Math.max(1, spec.rounds) - 1);
  const within = sec - idx * cycle;
  const work = within < spec.workSec || idx === spec.rounds - 1;
  return { idx, work, segmentEnd: idx * cycle + (work ? spec.workSec : cycle) };
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
    interval: null,
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

  if (spec.kind === 'tabata') {
    const { idx, work, segmentEnd } = tabataPosition(spec, clamped);
    const left = Math.ceil(Math.max(0, segmentEnd - clamped));
    return {
      ...base,
      phase,
      elapsedSec: clamped,
      displaySec: left,
      direction: 'down',
      progress,
      round: idx + 1,
      roundCount: Math.max(1, spec.rounds),
      roundRemainingSec: left,
      interval: work ? 'work' : 'rest',
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

  let lastSegmentStart = lead + 1;
  if (spec.kind === 'emom') lastSegmentStart = lead + (spec.rounds - 1) * spec.intervalSec + 1;
  if (spec.kind === 'tabata') {
    const cycle = spec.workSec + spec.restSec;
    for (let i = 0; i < spec.rounds; i++) {
      const workAt = lead + i * cycle;
      if (i > 0) {
        cues.push(...countdownTicks(workAt, workAt - spec.restSec + 1));
        cues.push({ atSec: workAt, kind: 'interval' });
      }
      if (i < spec.rounds - 1) {
        const restAt = workAt + spec.workSec;
        cues.push(...countdownTicks(restAt, workAt + 1));
        cues.push({ atSec: restAt, kind: 'rest' });
      }
    }
    lastSegmentStart = lead + (spec.rounds - 1) * cycle + 1;
  }

  const total = totalWorkSec(spec, clock.extraSec);
  if (total != null) {
    const end = lead + total;
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

/**
 * Jumps to the start of the next EMOM interval or Tabata work/rest (or ends the lead-in)
 * by moving `startedAt` back; the other timers are unchanged.
 */
export function skipSegment(spec: TimerSpec, clock: TimerClock, now: number): TimerClock {
  const sinceStart = runningMs(clock, now) / 1000;
  let target: number | null = null;
  if (sinceStart < clock.leadInSec) target = clock.leadInSec;
  else if (spec.kind === 'emom' || spec.kind === 'tabata') {
    const total = totalWorkSec(spec, clock.extraSec) ?? 0;
    const elapsed = sinceStart - clock.leadInSec;
    if (elapsed >= total) return clock;
    const end =
      spec.kind === 'emom'
        ? (Math.floor(elapsed / spec.intervalSec) + 1) * spec.intervalSec
        : tabataPosition(spec, elapsed).segmentEnd;
    target = clock.leadInSec + Math.min(end, total);
  }
  if (target == null || target <= sinceStart) return clock;
  return { ...clock, startedAt: clock.startedAt - (target - sinceStart) * 1000 };
}
