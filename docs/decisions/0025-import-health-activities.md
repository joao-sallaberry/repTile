# 0025. Import picked Google Health activities as history entries

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

ADR 0021 only attached Google Health data to workouts done in RepTile. The user also trains without the app (e.g. CrossFit classes recorded only on the watch) and wants every record of the activities they pick to show up in the history, with just the Google Health data when no RepTile workout was done at the same time.

Options considered:

1. **A session row per imported record** (`sessions.origin = 'health'`, no blocks), linked through the existing `session_health` table. History, calendar, Home, the weekly goal and the session cards keep working as they are.
2. **A separate table** of imported records, merged with `sessions` in every list (Histórico, Home, week summary, calendar). Cleaner separation, but every query and screen that lists workouts would need a second source.

How an activity is picked: Health Connect has no CrossFit exercise type, and Google Health's mapping of its activities isn't documented, so picking by type constant could also pull in unrelated "Outro treino" records.

## Decision

Option 1, with activities picked by their **display name** (the record's title, else its type label: `exerciseName`), case-insensitive.

- Ajustes › Google Health › "Importar atividades" lists the activities found in Health Connect in the last 30 days (with counts) and saves the picks per device (`import-prefs.ts`).
- `importHealthWorkouts` (`repo.ts`) runs when the app opens, when it comes back to the foreground (at most every 5 minutes; Health Connect reads only in the foreground) and when the picks are saved. It first runs `autoLinkSessions`, so the app's workouts claim their records, then imports each record of the last 30 days that lasts more than a minute (shorter ones are accidental starts on the watch), is of a picked activity, isn't known yet (any `session_health` row holds its id) and doesn't overlap any RepTile workout, finished or in progress (pure rule: `recordsToImport` in `import.ts`). Overlap at all counts as "the same time".
- An imported session is named after the activity, has no location and no blocks; its `session_health` row is inserted with it, then `linkHealth` fills in heart rate and calories.
- When a RepTile workout links to a record an import holds (automatic or by hand), or covers an import's time after the fact (`supersededImports`), the imported session and its link are soft-deleted, so the record shows once.
- Deleting an imported session from the history keeps its `session_health` row, so it isn't imported again.

## Consequences

- Imported sessions count for the weekly goal, the week's training time and the history totals, like any finished session; they never take part in the routine rotation (no `workout_id`).
- Screens must check `origin`: the history screen hides records and ⋮ › Dados do Google Health for imports and says "Importado do Google Health"; the session card says "Google Health".
- Renaming an activity in Google Health (a different title) makes it a different activity to pick.
- Only the last 30 days can be read (no history permission), so older records are never imported.
