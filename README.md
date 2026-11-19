# RepTile 🦖

Android app (React Native + Expo) to plan and run gym and CrossFit workouts.

- **Home**: this week's trained days (Monday to Sunday) against an optional weekly goal, the next routine in your rotation, a "Treino livre" (empty workout, can be saved as a routine at the end), your routines with one-tap start, recent PRs and the last workouts. First use offers ready-made workouts ("treinos prontos": ABC's A, B and C, Full body, Fran, Cindy). Running one doesn't create a routine; tick "Salvar como rotina" when finishing to keep it.
- **Treinos**: your routines in alphabetical order with their exercises and location and a ▶ to start, search, filters (strength, WOD, location) and the ready-made workouts ("Treinos prontos"). Tapping a routine shows its exercises, stats (sets, average duration), best WOD results and past runs.
- **Blocks**: a workout is a list of blocks — plain exercises and timed WOD blocks (AMRAP, EMOM — also alternating, one movement per interval —, For Time and Tabata) in any mix, done in any order. Blocks can also be added during a workout, and blocks and exercises can be reordered by dragging, in the routine editor and during a workout.
- **Exercises** (Hevy-style set log): warm-up, normal, drop and to-failure sets, each with its own weight and reps; a "Previous" column with what you did last time; automatic rest timer between sets (warm-ups can skip it, in Ajustes), whose time can be set per exercise or for all of them at once. Several exercises can be added at once, with the recently used ones first. When finishing, the workout can be renamed (the routine name by default) and its start and end times adjusted; the dialog sums up the duration, sets done and records, and warns about sets left unmarked.
- **Equipment**: each exercise lists the equipment it can be done with (livre/bodyweight, barbell, band, dumbbell, suspension trainer, kettlebell, cable, machine, other), editable on its screen; exercise lists can be filtered by equipment, and the Exercícios tab also by muscle group. When there are several (e.g. a curl with barbell, dumbbells or cable, or a lunge with dumbbells or bodyweight), routines and sessions pick the one used, and "Anterior" and PRs are kept per equipment.
- **Exercise library**: ~150 common gym and CrossFit exercises, most of them with an illustration per equipment (animated start/peak poses on the exercise's screen, a still thumbnail in lists and in the workout — tap it to see the movement). You can also create your own. The Exercícios tab shows each exercise's best set and when it was done (recent records get a PR badge), with the exercises of the last week first.
- **Locations and machines**: a workout can belong to a gym or box; a machine or cable exercise can be done on a specific machine or cable station. A routine can have a different version per location (other exercises, order, sets): starting it uses the version of the current location, and its screen lets you pick another. Machines are optional, can be shared by several locations, and keep their own load history and PRs. Each machine can have a low-res photo (camera or gallery) to recognise it at the gym: open the machine from the machine picker in a workout (camera button), from the exercise's screen ("Máquinas") or from its location.
- **WOD blocks**: a full-screen timer per format with lead-in countdown — EMOM dial with current/next movement and "Pular", AMRAP round counter with pace, For Time rounds with splits, Tabata with work/rest colors and reps per round — and a result per block with PRs; the result form shows the best earlier run (or that this one is a record) and each round's time, the slowest highlighted.
- **Notifications**: alerts when a rest or WOD ends, even with the screen off or the app killed. Beeps play on the media volume, so they're heard on headphones over music. The needed permissions are asked on a welcome screen at first launch, whose main button requests the next one still missing, and can be reviewed in Settings, which shows how many are missing.
- **Workout summary**: after finishing, "Treino concluído!" shows duration, volume, sets, the new records (and what they beat), each exercise's best set and the WOD results; "Atualizar rotina com este treino" lets you pick what the routine takes from today: its exercises and order (exercises and blocks added, removed or reordered during the workout) and/or its sets, loads and rest as the new targets.
- **History**: a month calendar with the trained days and record days, the month's totals, filters (with records, WOD, per routine) and the workouts grouped by week. A finished workout shows its stats (with the volume change vs. the last time), new records, every set (PRs and skipped ones marked), WOD results with round splits, lets you fix its start/end times and start it again.
- **Google Health (Fitbit)**: each finished workout is linked to the watch workout recorded at the same time, read from Health Connect, and shows its average/max heart rate, calories and a heart-rate chart; workout cards (Histórico, routine screen) show the average heart rate and calories with a heart icon. Connect in Ajustes (which can also link the last 30 days); the Google Health app must also be allowed to write to Health Connect, and Ajustes warns and opens that screen when no workout is reaching it; ⋮ › Dados do Google Health on a workout picks another record (each one shows how much of the workout it covers) or unlinks it. Ajustes › Importar atividades picks watch activities (e.g. CrossFit) that always go into the history: a record longer than a minute with no RepTile workout at the same time shows up on its own, with only the Google Health data (imported when the app opens or comes back to the foreground; it gives way if a workout is later logged at that time). Android 8+ with Health Connect; only the last 30 days can be read, so the data is copied when linked.
- **PRs**: max weight, estimated 1RM, volume and a progression chart per exercise (load, estimated 1RM or volume; filterable by machine), with recent records marked as new and every set of the last workouts. Warm-up sets don't count towards volume or PRs.

Data is stored on the device (SQLite). The app UI is in Portuguese.

Exercise illustrations: Exercise data by [RepDB (repdb.co)](https://repdb.co), free tier, used under its [license](https://github.com/sergei-argutin/exercise-dataset/blob/main/LICENSE-DATA.md) (in-app use with attribution; no redistribution of the images as a dataset, no generative-AI use). The images are **not** in this repository: `npm install` downloads them (see below).

## Requirements

- Node.js 22+
- Android SDK (installed by Android Studio in `~/Android/Sdk`)
- **JDK 17** — the Java bundled with Android Studio (25) does not work with React Native's native build.

Environment variables (in `~/.zshrc` or `~/.bashrc`):

```sh
export ANDROID_HOME=$HOME/Android/Sdk
export JAVA_HOME=$HOME/.local/jdk-17   # path to your JDK 17
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

## Development

```sh
npm install
npm run android   # builds the dev build, installs it on the USB-connected phone and starts Metro
```

`npm install` also downloads the exercise illustrations (~6 MB) into `assets/exercise-media/` and generates `src/features/exercises/media.generated.ts`. Both are git-ignored; never commit them (RepDB license). Without network the install still works and exercises show no images; run `npm run media:fetch` later.

The development build (with `expo-dev-client`) loads JavaScript from Metro on your computer, over Wi-Fi:

1. Start Metro: `npx expo start`.
2. Open RepTile on the phone (same Wi-Fi network as the computer). It reconnects to the last server; otherwise the launcher lists the servers it finds — tap yours, or scan the QR code from the terminal.
3. Edit the code: changes show up in seconds (Fast Refresh).

USB is only needed to install a new dev build, after a native change (new native dependency, `app.json`, icons). Over USB you can also run `adb reverse tcp:8081 tcp:8081` and connect to `localhost:8081`.

Other commands:

```sh
npm test            # tests (timer, PRs, exercise list marks, set labels/pairing, equipment, illustrations)
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run db:generate # generate a migration after changing src/db/schema.ts
npm run media:fetch # download missing exercise illustrations (also runs on npm install)
```

## Building a release APK

The release APK bundles the JavaScript: it opens straight from the launcher icon, no computer needed.

1. **(Only if you changed `app.json`, config plugins, native libraries, app icons or splash)** regenerate the native project:

   ```sh
   npx expo prebuild --platform android --clean
   ```

2. **Build**:

   ```sh
   cd android
   ./gradlew assembleRelease
   ```

   The first build takes a long time; later builds are much faster. The APK is written to:

   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

3. **Install** on the USB-connected phone:

   ```sh
   adb install -r app/build/outputs/apk/release/app-release.apk
   ```

   `-r` upgrades in place and keeps your data. Without a cable: send the `.apk` to the phone (Drive, Telegram…), open the file and allow the installation.

## Project structure

```
index.ts                 # entry point: registers notifications and the timer foreground service
src/app/                 # screens (expo-router)
src/db/                  # Drizzle schema, migrations and seed exercises
src/features/timer/      # timer engine, beeps and notifications
src/features/home/       # home screen sections, week stats and the weekly goal
src/features/history/    # history tab: month calendar and week grouping
src/features/health/     # Health Connect (Google Health / Fitbit): heart rate and calories per workout
src/features/session/    # running workouts (exercise blocks and WOD blocks)
src/features/stats/      # PR calculations and each exercise's best set for the exercise list
src/features/places/     # locations, machines (and their photos) and the current location
src/features/workouts/   # workout editing and exercise equipment
src/features/exercises/  # exercise illustrations: seed exercise → RepDB image per equipment
scripts/                 # fetch-exercise-media.mjs (downloads the illustrations on npm install)
plugins/                 # config plugins (notification sounds)
assets/icon/             # mascot art + script that renders the app icons
docs/decisions/          # design decisions (ADRs)
```
