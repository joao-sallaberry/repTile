# 0014. Cable (Polia) equipment uses stations like machines

- **Status:** Accepted
- **Date:** 2026-10-18

## Context

Cable exercises (crossover, pushdown, face pull, shoulder rotations) were filed as `machine` (ADR 0011), because only machine exercises could record which station was used. A gym has several cable stations, with different pulleys and weight stacks, so the load history should also be per station.

Options: a separate `cables` table, or reuse `machines` for any station an exercise is done on.

## Decision

Add `cable` ("Polia") to `EQUIPMENT`. `machine` and `cable` exercises both pick a specific station from `machines` (`hasStation`); the UI calls it "polia" for cable exercises (`stationNoun`) and "máquina" otherwise. Linking a station to a cable exercise keeps it `cable`. Migration 0008 moves the seed cable exercises from `machine` to `cable` (only if the user hadn't changed them).

## Consequences

- One `machines` list holds both machines and cable stations; the picker shows them together ("Outros aparelhos").
- History, "Anterior" and PRs per station work the same for both (ADR 0006).
