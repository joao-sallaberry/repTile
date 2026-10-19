# 0015. Exercises list several equipment; the one used is recorded per set

- **Status:** Partly superseded by [0017](0017-livre-equipment.md)
- **Date:** 2026-10-18
- **Supersedes:** the "one equipment per exercise" part of [0011](0011-exercise-equipment.md)

## Context

ADR 0011 gave each exercise one equipment, so an exercise done with several (a biceps curl with a barbell, dumbbells or a cable) needed one exercise per equipment or "Outro". The loads aren't comparable across equipment, so mixing them in "Anterior" and PRs would be wrong, but splitting the exercise in three duplicates it in the library and on charts.

Options: keep one exercise per equipment; list the possible equipment only to describe and filter; or list them and record the one used in routines and sessions, like machines (ADR 0006).

## Decision

`exercises.equipment` becomes a JSON list of `EQUIPMENT` values (never empty; the first is the default; `none` excludes the others). `workout_items.equipment` and `session_sets.equipment` record the equipment used, always one of the exercise's. Routine items and session exercises with more than one choice show a menu to switch it; the station picker (machine or cable) only appears when the equipment used has a station.

"Anterior", pre-filled loads and PRs are per exercise **+ equipment + machine**. A session exercise added on the fly uses the equipment of the last time the exercise was done, else the default.

Migration 0009 wraps the old value in a list, gives a few seed exercises several equipment (only if the user hadn't changed them), and fills the new columns from the exercise (a station equipment when a machine was recorded).

## Consequences

- One exercise per movement: its screen can filter history and PRs per equipment/machine ("variant").
- Changing an exercise's list doesn't rewrite history: old sets keep the equipment they were done with.
- Exercise filters match exercises that can be done with any picked equipment.
