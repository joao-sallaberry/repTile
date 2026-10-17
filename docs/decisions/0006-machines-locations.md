# 0006. Optional machines, N:N with locations and exercises

- **Status:** Accepted
- **Date:** 2026-10-16

## Context

The same exercise (e.g. Leg Press 45°) feels different on different machines, so loads aren't comparable across them. The user trains in more than one place, and the same machine model can exist in several of them. Registering every machine up front would be tedious.

## Decision

- `locations` (gym/box) and `machines`, linked N:N by `location_machines`; machines link N:N to exercises by `machine_exercises`.
- Machines are optional. Picking or creating one during a session links it to the exercise and the session's location automatically; creating a location never requires machines.
- Routines may have a fixed location; otherwise a session uses the per-device current location.
- "Anterior", pre-filled loads and PR checks are per exercise **and** machine. Sets without a machine form their own group. A machine's history is shared across all its locations.

## Consequences

- Load history stays comparable without extra setup.
- Starting to use a machine on an exercise with history shows an empty "Anterior" the first time (the old sets are under "Sem máquina").
