# 0008. "Next in rotation" = routine done longest ago

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

The home screen suggests which routine to do next. Splits like ABC are done in turn, but the app has no notion of routine order, and asking the user to define one adds setup and UI (reordering, handling skipped days).

## Decision

Suggest the **strength** routine whose last finished session is the oldest; routines never done come first (oldest created first). WODs are not suggested. No new column or setting.

## Consequences

- Alternating A → B → C always surfaces the next one, with zero setup, and it self-corrects after a skipped or repeated day.
- Routines the user stopped doing keep coming back as "next" until deleted. If that becomes annoying, add an explicit order or an "archived" flag in a new ADR.
