# 0004. Timer notifications with react-native-notify-kit

- **Status:** Accepted
- **Date:** 2026-10-05

## Context

Users need an alert when rest or a WOD interval ends, even with the screen off. Notifee was the usual choice but was archived in April 2026.

## Decision

Use `react-native-notify-kit` (maintained Notifee fork): a foreground service (`specialUse`) with a native chronometer while a timer runs, and AlarmManager `SET_ALARM_CLOCK` triggers for end/interval beeps **only while the app is backgrounded**. In the foreground, `expo-audio` plays the cues instead, to avoid double sounds.

## Consequences

- Alerts survive Doze and a killed JS context.
- Two code paths for cues (foreground audio vs. scheduled notifications) that must stay in sync.
