# RepTile 🦖

Android app (React Native + Expo) to plan and run gym and CrossFit workouts.

- **Strength** (Hevy-style set log): warm-up, normal, drop and to-failure sets, each with its own weight and reps; a "Previous" column with what you did last time; automatic rest timer between sets.
- **Locations and machines**: a workout can belong to a gym or box; an exercise can be done on a specific machine. Machines are optional, can be shared by several locations, and keep their own load history and PRs.
- **WODs**: AMRAP, EMOM and For Time, with a full-screen timer and lead-in countdown.
- **Notifications**: alerts when a rest or WOD ends, even with the screen off or the app killed.
- **History and PRs**: max weight, estimated 1RM, volume and a progression chart per exercise (filterable by machine). Warm-up sets don't count towards volume or PRs.

Data is stored on the device (SQLite). The app UI is in Portuguese.

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
npm run android   # builds, installs on the USB-connected phone and starts Metro
```

The development build loads JavaScript from your computer: the phone must stay connected by USB with Metro running (`npx expo start`). If the app shows "Unable to load script", run `adb reverse tcp:8081 tcp:8081` and tap **Reload**.

Other commands:

```sh
npm test            # tests (timer, PRs, set labels/pairing)
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run db:generate # generate a migration after changing src/db/schema.ts
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
src/features/session/    # running workouts (strength and WOD)
src/features/stats/      # PR calculations
src/features/places/     # locations, machines and the current location
src/features/workouts/   # workout editing
plugins/                 # config plugins (notification sounds)
assets/icon/             # mascot art + script that renders the app icons
```
