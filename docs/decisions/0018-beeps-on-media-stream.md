# 0018. Background timer beeps play on the media stream

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

ADR 0004 made the scheduled (background) timer notifications beep through their channel sound. Android plays channel sounds on the notification stream, so with Bluetooth headphones playing music the beep was not heard: the notification showed up and vibrated, but no sound reached the headphones. In the foreground the beeps already came from `expo-audio` on the media stream and were heard.

## Decision

The end and interval channels only vibrate (no sound). When one of their notifications is delivered, the app plays the beep itself with `expo-audio` (`playCue` in `beeps.ts`, media stream, ducking other audio), using the cue kind stored in the notification's `data`. The new channels have new ids (`timer-end-v2`, `timer-cue-v2`) because Android doesn't let an app change a channel's sound after it's created; the old ones are deleted.

Alternatives considered: patching `react-native-notify-kit` to create the channels with `USAGE_ALARM` (rings on the speaker too, at alarm volume, and means maintaining a native patch), or keeping the channel sound and also playing the media beep (double beep on the speaker without headphones).

## Consequences

- Beeps follow the music to headphones and use the media volume, in the foreground and the background alike.
- The beep needs the JS context to run when the notification is delivered. The timer's foreground service keeps the process alive while a timer runs, and notify-kit starts a headless context otherwise, but if neither happens the alert only vibrates.
- `assets/sounds/` is still copied to `res/raw` but no channel uses it now.
