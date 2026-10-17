# 0013. Use expo-dev-client for development over Wi-Fi

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

Testing every change meant building and installing a release APK (several minutes on this machine), or keeping the phone on USB with `adb reverse tcp:8081 tcp:8081` so the plain debug build could reach Metro on `localhost`. Pointing the debug build at the computer's IP works too, but it's set by hand in the debug menu and breaks when the IP changes.

Options: keep release builds for testing; plain debug build with a manual IP; `expo-dev-client`. EAS Update was not considered (needs an Expo account; we want everything local and free).

## Decision

Add `expo-dev-client` (default config: `launchMode: most-recent`). Debug builds open the dev launcher, which lists the Metro servers on the local network and opens `npx expo start`'s QR code, and reconnect to the last one on the next launch. The phone only needs USB to install a new dev build (after native changes).

## Consequences

- Day-to-day JS changes show up in seconds with Fast Refresh, over Wi-Fi; phone and computer must be on the same network.
- It's a native dependency: debug builds must be rebuilt once to include it. Release builds don't include the launcher.
- Debug builds are slower than release ones; check performance and animations on a release build.
