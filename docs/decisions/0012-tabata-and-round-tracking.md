# 0012. Tabata blocks and per-round tracking

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

The WOD timer screens were redesigned (one full-screen layout per format) and a fourth format, Tabata, was added. The new screens show round splits (AMRAP, For Time), skip to the next EMOM interval and count reps per Tabata round. None of that had a place in the data model or the timer engine.

Options for Tabata: model it as an EMOM variant (interval + "rest part") or as its own block kind. For per-round data: one row per round in a new table, or a JSON array on `session_blocks`.

## Decision

- `tabata` is a new `BLOCK_KINDS` value with its own settings `work_sec` / `rest_sec` (plus the shared `rounds`). There is no rest after the last round. Its movements are done one per round, in turn (`tabataMovementIndex`). The engine has a `tabata` `TimerSpec`; snapshots carry `interval: 'work' | 'rest'` and the cues add a `rest` kind (end beep), so work and rest sound different.
- Per-round data lives in two JSON columns on `session_blocks`: `round_splits` (elapsed seconds when each AMRAP/For Time round was marked done) and `round_reps` (reps per Tabata round). They're written while the timer runs (`updateWodProgress`), so they survive the app being killed.
- The Tabata result is the total reps (`result_reps`); its PR compares total reps. The "worst round" (classic Tabata score) is shown, derived from `round_reps`.
- "Pular" (EMOM, lead-in) moves the clock's `startedAt` back to the next boundary (`skipSegment`); the engine stays timestamp-based.

## Consequences

- Splits are only as good as the taps: they're the elapsed time when "+ Round" / "Round feito" was pressed.
- JSON columns can't be queried per round in SQL; fine for display, revisit if we chart round paces.
- Migration 0006 only adds nullable columns; no data changes.
