# 0020. Routines have one version per location

- **Status:** Accepted
- **Date:** 2026-11-05

## Context

The user trains the same routine (e.g. "Pull") in different places, and each place calls for a different workout: other exercises, order, sets and loads. A routine had one optional location (`workouts.location_id`) and one list of blocks.

Options considered:

1. Two routines ("Pull – A", "Pull – B"). Works today, but the rotation treats them as different routines and suggests one right after the other, history and WOD records are split, and "Fazer de novo" / "Atualizar rotina" only reach one of them.
2. A per-item location filter (an item is done only at some locations). Shared exercises stay in one place, but the order is shared, so it can't express "everything can change".
3. Full versions of the routine per location.

## Decision

Option 3, with the least schema change: `workout_blocks.location_id` (nullable). A routine's blocks are grouped by it into **variants**:

- `null` = the main variant, done at the routine's fixed location (`workouts.location_id`) if it has one, else at any location without its own variant. Every routine has it.
- Any other value = that location's own version of the routine (blocks, items, sets, order: all of it). Block positions count within each variant.

Starting a routine picks the variant of the current location if it has one, else the main one at the routine's fixed location (else the current one) — `pickVariant` in `src/features/workouts/variants.ts`. The routine screen lets the user pick another variant explicitly before starting. A variant's location can't be the routine's fixed location (the picker excludes it).

The editor shows variant chips; a new variant starts as a copy of the one being edited.

## Consequences

- One routine, one rotation entry and one history, whatever the location. Sessions point at the variant's blocks through `session_blocks.workout_block_id`, so WOD PRs compare runs of the same variant, and "Atualizar rotina com estes valores" updates the variant that was done.
- Lists (Home, Treinos) describe the variant of the current location and show every location the routine is set up for; the location filter matches any of them.
- Every reader of `workout_blocks` must filter by variant (`blocksOf`), or it mixes versions.
- Exercises shared by several variants are duplicated: editing one doesn't change the others.
