# 0024. Google Health records match a session only above 50% of it

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

ADR 0021 linked a session automatically to the exercise record with the largest overlap covering at least half of the **shorter** of the two. A short record inside a long session (e.g. a 15-minute walk recorded during a 1-hour workout) covered 100% of itself and got linked, although the picker showed it as "25% do treino". The user wants a record linked only when it overlaps more than 50%.

Options considered:

1. Share of the shorter of the two (the old rule).
2. Share of the session, the same number the picker shows ("N% do treino").
3. Share of both (the record must also be mostly inside the session).

## Decision

Option 2: `bestMatch` only accepts a record whose overlap is **more than 50% of the session's duration** (strictly greater); among those, the largest overlap wins. A long record covering the whole session still matches.

## Consequences

- The automatic match and the picker's "N% do treino" use the same measure, so the preselected record is never one the picker shows at 50% or less.
- Short records no longer match on their own; the user can still link them by hand in ⋮ › Dados do Google Health.
- Links saved under the old rule stay as they are; only sessions without a link are matched again.
