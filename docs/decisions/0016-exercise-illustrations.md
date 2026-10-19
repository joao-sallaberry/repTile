# 0016. Exercise illustrations from RepDB, downloaded on install

- **Status:** Accepted
- **Date:** 2026-10-18

## Context

Exercises had no images. We want a simple animation of each movement, free to use, and a larger exercise library.

Options considered:

- GIF datasets (ExerciseDB and its mirrors, hasaneyldrm/exercises-dataset): the code is MIT but the GIFs are © Gym visual and need a paid license.
- free-exercise-db (Unlicense): public domain photos, 2 frames each, uneven quality.
- RepDB free tier (650 exercises, 512 px flat illustrations, start/peak poses, one variant per equipment): free for in-app use, including commercial, with a visible attribution. It forbids redistributing the data or images as a dataset, repo or API, and using the images for generative AI.

The user preferred RepDB's illustrations. This repository is public on GitHub.

## Decision

Use the RepDB free tier, pinned to one commit of its official repo. `src/features/exercises/media-map.json` (committed; only ids) maps each seed exercise and equipment to a RepDB exercise. `scripts/fetch-exercise-media.mjs` runs on `postinstall` (and `npm run media:fetch`). It downloads only the mapped images into `assets/exercise-media/` and generates `media.generated.ts` with the `require()` calls Metro needs. Both outputs are git-ignored, so the images ship inside the APK but never in the repo.

`ExerciseMedia` alternates the poses (~0.9 s, crossfade) on the exercise screen and in the workout's "how to" dialog. Lists show the peak pose still, to keep them calm and cheap. Settings shows the required credit, "Exercise data by RepDB (repdb.co)", linking to repdb.co, and the README credits it too.

The seed grows to ~150 common exercises (names in pt-BR, our own translation). Duplicates that only differed in equipment were merged (ADR 0015): "Supino com halteres" became the dumbbell variant of "Supino reto" (migration 0010 moves its history).

## Consequences

- `npm install` needs network to get the images; without it the app builds and shows no illustrations.
- Custom exercises and a few CrossFit movements RepDB lacks (GHD sit-up, double under, chest to bar…) have no image.
- The APK grows by ~6 MB (WebP 512 px, ~350 files).
- Never commit the images, never feed them to generative AI tools, and keep the credit visible.
- Instructions/tips from RepDB aren't used (no Portuguese); adding them would mean translating them ourselves.
