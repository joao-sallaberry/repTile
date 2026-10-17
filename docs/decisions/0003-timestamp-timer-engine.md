# 0003. Timestamp-based timer engine

- **Status:** Accepted
- **Date:** 2026-10-05

## Context

JS timers are paused or throttled when the app is in the background, so a timer that counts ticks drifts or stops.

## Decision

The timer state is only timestamps (`startedAt`, `pausedTotalMs`, `extraSec`); elapsed/remaining time is always derived from `Date.now()`. The engine (`src/features/timer/engine.ts`) is pure and unit-tested; state is persisted in Zustand.

## Consequences

- The timer is correct after backgrounding, screen-off or an app restart.
- Never accumulate ticks; UI intervals only trigger re-renders.
