@AGENTS.md

# RepTile — project notes

RepTile (rep + reptile; the icon is a cute orange T-rex lifting a barbell) is a personal Android-first workout app (gym strength + CrossFit WODs). Expo SDK 57, React Native 0.86, TypeScript, expo-router. See `README.md` for user-facing setup and release steps.

## Keep docs up to date

After any change that affects them, update **both** files in the same task — don't wait to be asked:

- `README.md` — features, requirements, commands, release steps, project structure (user-facing).
- `CLAUDE.md` — architecture, conventions, gotchas (for Claude).

Examples that require an update: new feature or screen, new npm script, new dependency with native code, changed build/release steps, new folder under `src/`, schema change that alters the data model description.

## Design decisions (ADRs)

`docs/decisions/` holds one Architecture Decision Record per significant decision (see its `README.md` for the rules and index). When a task involves a choice that is hard to reverse, changes the data model, adds a native dependency, or picks one option over a reasonable alternative, write a new ADR from `template.md` in the same task and add it to the index. Don't rewrite accepted ADRs: supersede them with a new one. Read the relevant ADRs before changing an area they cover.

## Commands

```sh
npm test             # jest (pure logic: timer engine, PRs, set labels/pairing, target summaries)
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
npm run db:generate  # drizzle-kit migration after editing src/db/schema.ts
npm run android      # dev build on the USB-connected phone (Pixel 6a, Android 17)
cd android && ./gradlew assembleRelease   # release APK
```

Run `npm run typecheck`, `npm run lint` and `npm test` before calling a task done.

## Architecture

- **Routes** in `src/app/`: `(tabs)/` (index, workouts, history, exercises) uses `NativeTabs`; stack screens `workout/[id]`, `workout/edit`, `session/[id]`, `history/[id]`, `exercise/[id]`, `locations/index`, `locations/new`, `locations/[id]`, `machines/[id]`, `settings`, `welcome`. `welcome` is shown once on first launch (`(tabs)/_layout` redirects while `hasSeenWelcome()` in `src/lib/welcome.ts` is false) and asks for the timer permissions; `settings` (gear on Home) shows the same `TimerPermissionsList` later. Don't put permission prompts on Home. Shared pickers live in `src/components/` (`location-picker`, `machine-picker`, `machine-thumb`, `set-type-dialog`, `set-badge`).
- **Data**: local-first SQLite via Drizzle (`src/db/`). Screens read with `useLiveQuery`; writes go through repos (`src/features/workouts/repo.ts`, `src/features/session/repo.ts`, `src/features/places/repo.ts`).
- **Timer** (`src/features/timer/`):
  - `engine.ts` — pure, timestamp-based (`startedAt`, `pausedTotalMs`, `extraSec`); never accumulate ticks. Fully unit-tested.
  - `store.ts` — single active timer (rest or WOD) in Zustand, persisted to `expo-sqlite/kv-store`.
  - `notifications.ts` — `react-native-notify-kit` (maintained Notifee fork; Notifee was archived in Apr 2026). Foreground service with native chronometer while a timer runs; AlarmManager triggers (`SET_ALARM_CLOCK`) for end/interval beeps **only while the app is backgrounded**; in foreground `cue-player.ts` plays beeps via `expo-audio` to avoid double sounds.
  - `index.ts` (app entry) registers the foreground service and background event handler before `expo-router/entry`.
- **Sessions**: starting a workout snapshots its config into `sessions` and creates `session_sets`. Strength sets are completed one by one; WOD sets are marked complete when the session finishes. PR stats only count `strength` sessions. Start sessions through `src/features/session/begin.ts` (`beginRoutine`, `beginFreeWorkout`): it enforces one session in progress at a time. Weights default to **0**, never empty: routine targets are created with 0, and a 0 kg target means "no target" (the session pre-fills last time's load, else 0). The finish dialog lets the user adjust start/end times (`TimeField`, `@react-native-community/datetimepicker`, Android imperative API); `finishSession` accepts `startedAt`/`finishedAt`. A "Treino livre" is a strength session with `workout_id = null`; finishing it can turn it into a routine (`saveSessionAsRoutine`, which also points the session at the new routine).
- **PR flags** (ADR 0009): `session_sets.is_pr` is written by `completeSet` (and re-evaluated by `updateSet`/`setSetType`, cleared by `uncompleteSet`); `sessions.is_pr` is set by `finishSession` for AMRAP/For Time when the result beats every earlier run of the same routine (`isWodPR`). Home/history read these flags instead of recomputing PRs. "N PRs" counts one per exercise per session.
- **Home** (`src/features/home/`): `(tabs)/index.tsx` composes the sections. Three states: first use (no routines, no sessions → `FirstUse` with templates from `src/features/workouts/templates.ts`), session in progress (`ActiveSessionCard`, compact week, last sessions; start options hidden), and normal (`WeekCard`, `StartSection`, `RoutineList`, `RecentPrs`, `RecentSessions`). Queries in `queries.ts`; pure helpers in `stats.ts` (tested): weeks start on **Sunday**, `nextInRotation` = strength routine done longest ago, never-done first (ADR 0008). The weekly goal is a per-device setting (`goal.ts`, edited in Ajustes).
- **Set types** (`SET_TYPES`: warmup/normal/drop/failure): strength routines store one target row per set in `workout_item_sets` (the `workout_items.sets` column only mirrors the count; WOD items keep reps/weight on the item). `src/features/session/sets.ts` has the pure helpers: `setLabels` (W, 1, 2, D, F — only normal sets are numbered), `pairPrevious` (the "Anterior" column pairs sets by type + order) and `countsTowardStats` (warm-ups never count for volume/PRs). New warm-ups are inserted after the existing warm-ups, before working sets.
- **Locations & machines**: `locations` (gym/box), `machines`, `location_machines` (N:N) and `machine_exercises` (N:N). Machines are optional: picking/creating one in a session links it to the exercise and the session's location automatically. `workouts.location_id` is the routine's fixed location (optional); `sessions.location_id` is where it was done (falls back to the per-device current location, `src/features/places/current.ts`). `workout_items.machine_id` / `session_sets.machine_id` record the machine. "Anterior", pre-filled loads and PR checks are per exercise **and machine** (`performedSets(exerciseId, { machineId })`: `undefined` = any, `null` = no machine); a machine's history is shared across all its locations.
- **Machine photos** (`src/features/places/photos.ts`): `expo-image-picker` (camera or gallery) → `expo-image-manipulator` downscales to 800 px on the longest side, JPEG 0.6 (~50–100 KB) → moved into `<document>/machine-photos/`. `machines.photo` stores only the file name (resolve with `machinePhotoUri`); file names carry a timestamp so `expo-image` doesn't show a cached old photo, and the previous file is deleted on replace/remove. Photos are local only — they won't sync until uploaded to Supabase Storage.
- Migration `0001` expands the old "N sets of R reps" strength items into `workout_item_sets` rows (hand-written SQL appended after the generated DDL). Hand-edit migrations only by appending, and test them in SQLite (e.g. Python `sqlite3`) before shipping.

## Conventions

- **Language**: code, comments, tests and docs in English; **app UI strings in Portuguese** (pt-BR).
- Every table has sync columns (`id` UUID, `userId`, `createdAt`, `updatedAt`, `deletedAt`, `dirty`) for the planned Supabase sync. Use `createdFields()` / `touched()` from `src/lib/ids.ts`; delete with soft delete (`deletedAt`), and filter `isNull(deletedAt)` in queries.
- Seed exercises use fixed IDs `seed-<slug>` (`src/db/seed.ts`).
- Never edit `android/` or `ios/` by hand (generated by `expo prebuild`); use `app.json` and config plugins in `plugins/`. Notification sounds live in `assets/sounds/` and are copied to `res/raw` by `plugins/with-raw-sounds.js`.
- Install packages with `npx expo install`.
- App icons and splash in `assets/images/` are generated from the mascot art `assets/icon/mascot.png` (dino + "RepTile" wordmark on off-white) by `python3 assets/icon/render.py assets/images [preview_dir]` (needs Pillow). The script crops off the wordmark, flood-fills the outer background (plus the floor shadow around the feet) to transparent, and builds the adaptive layers (off-white `#FDFCF9` background, matching `adaptiveIcon.backgroundColor` in `app.json`), a monochrome layer with the dark details cut out, and the splash. If the art changes, re-check `DINO_BOTTOM` / `SHADOW_BOX` and the previews. Don't edit the PNGs by hand. Gradle builds don't pick up icon/splash changes on their own: run `npx expo prebuild --platform android --clean` first.
- Android package / iOS bundle id: `dev.joaosallaberry.reptile` (was `com.joao.reptile` while testing). Changing it installs a separate app (data not migrated), so avoid it once there's real data, and it's impossible after publishing to the Play Store.

## Build environment gotchas (this machine)

- Only 6.5 GB RAM. `~/.gradle/gradle.properties` limits Gradle (2 workers, in-process Kotlin, arm64 only). `~/Android/Sdk/cmake/3.22.1/bin/ninja` is a wrapper forcing `-j4` (real binary: `ninja.real`); recreate it if CMake is updated.
- Use **JDK 17** (`JAVA_HOME=$HOME/.local/jdk-17`). Android Studio's bundled JBR is Java 25 and breaks prefab (`WARNING: A restricted method in java.lang.System has been called`).
- Dev build: after the phone locks/reconnects, run `adb reverse tcp:8081 tcp:8081`.
- Release builds are signed with the debug keystore (fine for sideloading; installs over the dev build keeping data).

## Roadmap

- Supabase auth + sync (last-write-wins on `updatedAt`, push `dirty` rows) — needs the user's Supabase project. Machine photos need Supabase Storage (upload the file, sync the name/path).
- UI polish: card title padding, tab labels only shown on the selected tab.
- Not built yet from the design: per-exercise notes in a session, superset links, "update routine with these values" on the summary, a dedicated "workout finished" summary screen (history detail is used instead), and rep ranges like "12–15" in routine targets (targets are plain numbers).
