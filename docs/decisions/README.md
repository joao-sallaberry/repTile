# Design decisions

Architecture Decision Records (ADRs): one short file per decision that shaped the app, so the *why* survives after the code changes.

## When to write one

Write an ADR when a choice is hard to reverse, affects the data model, adds a native dependency, or when you picked one option over a reasonable alternative. Bug fixes and routine features don't need one.

## How

1. Copy `template.md` to `NNNN-short-title.md` (next number, kebab-case).
2. Fill in context, decision and consequences. Keep it under a page.
3. Add it to the index below.

ADRs are not edited after they're accepted, except to fix typos or change the status. To change a decision, write a new ADR and mark the old one `Superseded by NNNN`.

## Index

| #    | Decision                                                                    | Status   | Date       |
| ---- | --------------------------------------------------------------------------- | -------- | ---------- |
| 0001 | [React Native + Expo with development builds](0001-react-native-expo.md)    | Accepted | 2026-10-05 |
| 0002 | [Local-first SQLite with sync-ready columns](0002-local-first-sqlite.md)    | Accepted | 2026-10-05 |
| 0003 | [Timestamp-based timer engine](0003-timestamp-timer-engine.md)              | Accepted | 2026-10-05 |
| 0004 | [Timer notifications with react-native-notify-kit](0004-timer-notifications.md) | Accepted | 2026-10-05 |
| 0005 | [Set types and per-set targets](0005-set-types-per-set-targets.md)          | Accepted | 2026-10-16 |
| 0006 | [Optional machines, N:N with locations and exercises](0006-machines-locations.md) | Accepted | 2026-10-16 |
| 0007 | [Local low-res machine photos](0007-machine-photos.md)                      | Accepted | 2026-10-17 |
| 0008 | ["Next in rotation" = routine done longest ago](0008-rotation-least-recent.md) | Accepted | 2026-10-17 |
| 0009 | [Store PR flags on sets and sessions](0009-stored-pr-flags.md)                | Accepted | 2026-10-17 |
| 0010 | [Workouts are lists of blocks](0010-workouts-as-blocks.md)                 | Accepted | 2026-10-17 |
| 0011 | [Exercises have one equipment](0011-exercise-equipment.md)                 | Accepted | 2026-10-17 |
| 0012 | [Tabata blocks and per-round tracking](0012-tabata-and-round-tracking.md)    | Accepted | 2026-10-17 |
| 0013 | [Use expo-dev-client for development over Wi-Fi](0013-expo-dev-client.md)  | Accepted | 2026-10-17 |
| 0014 | [Cable (Polia) equipment uses stations like machines](0014-cable-equipment.md) | Accepted | 2026-10-18 |
