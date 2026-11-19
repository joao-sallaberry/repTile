# 0021. Link sessions to Google Health workouts through Health Connect

- **Status:** Accepted (automatic match rule superseded by 0024)
- **Date:** 2026-11-10

## Context

The user records workouts on a Fitbit watch. Since May 2026 the Fitbit app is the **Google Health** app, which writes exercise sessions, heart rate and calories to **Health Connect** (Android's on-device health store). The user wants each RepTile workout to show the watch data recorded at the same time; nothing new should be created from the watch data.

Options considered:

1. **Google Health API** (cloud REST, the successor of the Fitbit Web API): Google OAuth, a Google Cloud project and a backend to hold tokens. RepTile is local-first and has no backend yet.
2. **Health Connect** on the phone, through `react-native-health-connect` (v4 has the Expo config plugin built in; `expo-health-connect` is deprecated). No account and no network. Reads are foreground only and, without `READ_HEALTH_DATA_HISTORY`, limited to 30 days before the permission was first granted.

## Decision

Option 2. The user only needs data from now on, so the history permission isn't requested.

- New table `session_health` (1:1 with `sessions`, sync columns) holds a **snapshot** of the linked record: record id, source package, exercise type, title, times, average/max/min heart rate, calories (active if recorded, else total) and a per-minute heart rate series. It's a snapshot because Health Connect only lets RepTile read 30 days back: the data must stay after that.
- **Automatic match**: a finished session without a link is matched when its history or summary screen opens (Google Health syncs with a delay, so each visit retries), or for every session of the last 30 days from Ajustes. The match is the exercise record with the largest overlap covering at least half of the shorter of the two (`bestMatch`).
- **Manual fix**: ⋮ › Dados do Google Health on the history screen lists the records around the session to pick another one, or unlinks it. Unlinking keeps the row with `unlinked = 1` so the automatic match leaves the session alone.
- Permissions are asked only in Ajustes and in that dialog, never on Home. `minSdkVersion` goes up to 26 (Health Connect's minimum) via `expo-build-properties`.

## Consequences

- Only Android. Health Connect must be installed (built in from Android 14).
- `src/features/health/client.ts` is the only module that imports the library; the rest uses plain timestamps, so the matching and heart-rate math stay pure and tested.
- Heart rate and calories of a session can't be refreshed after 30 days; re-linking then fails to find the record.
- When sync comes, `session_health` syncs like any other table; the raw Health Connect data stays on the phone.
- Publishing on the Play Store would need the Health Connect data declaration form and a privacy policy (the rationale screen opens the main activity today).
