# 0005. Set types and per-set targets

- **Status:** Accepted
- **Date:** 2026-10-16

## Context

Routines stored "N sets of R reps at W kg". Hevy-style training needs warm-ups and sets whose weight and reps vary within one exercise.

## Decision

- Set types `warmup`, `normal`, `drop`, `failure`. Only normal sets are numbered (W, 1, 2, D, F).
- Strength routines store one target row per set in `workout_item_sets`; `workout_items.sets` only mirrors the count. WOD items keep reps/weight on the item.
- Warm-ups never count toward volume or PRs.
- The "Anterior" column pairs sets by type + order with the last session.
- Migration 0001 expanded existing items into per-set rows.

## Consequences

- Routines can describe pyramids and warm-up ramps.
- Targets are plain numbers; rep ranges like "12–15" are not supported yet.
