# 0011. Exercises have one equipment; only machine exercises pick a machine

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

Every exercise card in routines and sessions offered "Sem máquina · escolher", even for push-ups or barbell lifts, because nothing said which exercises are done on a machine (ADR 0006 made machines optional per exercise). We also want to know what an exercise is done with (barbell, dumbbell, band…) to describe and later filter it.

Options: a free-text field, a list of equipment per exercise (N:N), or one value from a fixed list.

## Decision

`exercises.equipment` holds one value of `EQUIPMENT`: `none`, `barbell`, `band`, `dumbbell`, `suspension`, `kettlebell`, `machine`, `other` (default `none`). The machine picker is only shown for `machine` exercises (or when a machine is already recorded). Linking a machine to an exercise turns it into a `machine` exercise.

Migration 0005 sets the equipment of the seed exercises and marks as `machine` every exercise already used with a machine. The user can change the equipment of any exercise, seed ones included, on its screen.

## Consequences

- Exercises done with several kinds of equipment (e.g. a lunge with dumbbells or a barbell) need one exercise per equipment, or "Outro".
- Seed equipment is only written by the migration and on first insert; seeding never overwrites it, so user edits stick.
- Machines keep working as before: history, "Anterior" and PRs per exercise and machine (ADR 0006).
