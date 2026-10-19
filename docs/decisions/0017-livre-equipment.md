# 0017. "Livre" (bodyweight) is one more equipment option

- **Status:** Accepted
- **Date:** 2026-10-19
- **Supersedes:** the "`none` excludes the others" rule of [0015](0015-multiple-equipment.md)

## Context

ADR 0015 made `none` exclusive: an exercise was either bodyweight or done with a list of equipment. But many movements are done both ways (lunges, glute bridges, back extensions, Russian twists), and the bodyweight version is a variant worth tracking on its own, just like a curl with a barbell or dumbbells. "Sem equipamento" also read badly as one item of a list ("Halter, barra, sem equipamento").

## Decision

`none` is an ordinary entry of `exercises.equipment`: it can be combined with any other equipment, and a session or routine can pick it like the others. The UI calls it **"Livre"** everywhere (chips, filter, menus, labels). `toggleEquipment` only keeps the list non-empty.

Migration 0011 adds "Livre" to Afundo and "Halter" to Afundo lateral (now measured by load × reps), only where the user hadn't changed them.

## Consequences

- "Anterior" and PRs of the bodyweight variant are separate from the loaded ones (the variant key already includes the equipment).
- Screens that hid the equipment for bodyweight exercises still show "Livre" when the exercise has several equipment.
