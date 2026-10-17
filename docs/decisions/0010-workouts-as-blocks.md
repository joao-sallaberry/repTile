# 0010. Workouts are lists of blocks

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

A workout had a single type (strength, AMRAP, EMOM or For Time). Real sessions mix them: a few lifts and then an EMOM, or a strength part followed by a short For Time. The user also wanted alternating EMOMs (minute 1: A, minute 2: B, …).

## Decision

- A workout has no type. It is an ordered list of **blocks** (`workout_blocks`): `exercises` (sets, warm-ups, rest — the old strength mode) or a WOD block (`amrap`, `emom`, `for_time`) with its timer settings and per-round movements. EMOM blocks have an `alternate` flag.
- Plain exercises are an `exercises` block, shown without a header when it's the only block, so a simple routine looks like before.
- Sessions snapshot each block into `session_blocks`, which also hold the WOD result and PR flag (moved from `sessions`, superseding that part of ADR 0009). Blocks can be done in any order; WOD blocks run in their own full-screen timer screen.
- Volume and load PRs only count sets of `exercises` blocks. WOD PRs compare a block against earlier runs of the same routine block (`workout_block_id`).
- Migration 0004 drops existing routines and history instead of converting them (the app is in testing).

## Consequences

- Any mix of lifting and conditioning fits one routine, and the rotation now covers every routine.
- More joins: anything that used to filter on the session type now joins `session_blocks`.
- Only one timer runs at a time, so a WOD block replaces a running rest timer.
