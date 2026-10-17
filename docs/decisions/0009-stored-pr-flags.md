# 0009. Store PR flags on sets and sessions

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

The home screen shows recent PRs, PR badges on past sessions and "N PRs this week". Computing that means replaying each exercise's whole history (per machine) every time the home screen renders. The app already decides whether a set is a PR when it's completed, to show the snackbar.

## Decision

Persist the result: `session_sets.is_pr` (strength sets, same exercise + machine, warm-ups excluded, never on the first time) and `sessions.is_pr` (AMRAP/For Time beating every earlier run of the same routine). The flag means "was a record when it was done" and is not revised when later sessions beat it. Editing or un-completing a set re-evaluates or clears its flag. Added in migration 0003.

## Consequences

- Recent PRs, badges and weekly counts are simple indexed queries.
- Flags can go stale if older history is edited or deleted after the fact; acceptable for a personal app. A recompute job could fix it if ever needed.
- Sessions recorded before migration 0003 have no flags.
