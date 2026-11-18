# 0023. Ready-made workouts run without becoming a routine

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

The app offered "modelos" (ABC clássico, Full body, Fran, Cindy) on first use and at the bottom of the Treinos tab. Tapping one saved its routines right away, without asking, and opened them. Routines the user never meant to keep (Fran and Cindy) showed up in the Treinos list, the rotation on Home and the history filters.

Options: ask for confirmation before installing; hide the templates once there are routines; or run the template as a workout and let the user decide afterwards whether to keep it.

## Decision

They are now "treinos prontos" (`READY_WORKOUTS` in `src/features/workouts/ready-workouts.ts`). Each one is a single workout, so the ABC program became three (Treino A, B, C). Tapping one starts a session with `workout_id = null` (`beginReadyWorkout` → `startReadyWorkout`, sharing `createSession` with `startSession`). It works like a "Treino livre" that starts filled in. It only becomes a routine when the user ticks "Salvar como rotina" in the finish dialog (`saveSessionAsRoutine`).

## Consequences

- Nothing is written to `workouts` unless the user asks for it, and an accidental tap can be discarded like any session.
- Sessions of a ready workout have no routine. They don't take part in the rotation, and their WOD results have no `workout_block_id`, so they get no WOD PRs and no "best earlier run" until saved as a routine. Running Fran twice without saving it doesn't compare the two runs.
- Installing a whole program (three routines at once) is no longer offered.
- Routines installed earlier from templates stay. The user deletes them like any routine.
