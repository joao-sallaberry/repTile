# 0019. Drag to reorder with a hand-written list on Reanimated

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Blocks and exercises need to be reordered both in the routine editor and in a session in progress. The editor had small ↑↓ buttons on every card, which were easy to miss and moved one step per tap; the session had no way to reorder at all.

## Decision

A full-screen "Reordenar" sheet (`src/components/reorder-sheet.tsx`, opened by a ⇅ button) lists the blocks (when there are several) and the exercises of each block as compact rows, dragged by a ≡ handle. The drag list (`draggable-list.tsx`) is written on `react-native-reanimated` and `react-native-gesture-handler`, both already in the app: rows have a fixed height, so the drag offset maps straight to a slot. Exercises move only within their block. The ↑↓ buttons in the editor were removed.

Alternatives considered: `react-native-draggable-flatlist` (one more dependency, and its maintenance lags behind Reanimated 4), dragging the full cards in place (variable heights and long cards make drops imprecise), or ↑↓ buttons in the compact list (what was chosen against when asking the user).

## Consequences

- No new dependency; the drag code is ~120 lines we own.
- Rows must keep a fixed height (`DRAG_ROW_HEIGHT`).
- Moving an exercise to another block isn't supported.
