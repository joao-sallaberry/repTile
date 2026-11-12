# 0022. Timer beeps mix with other audio instead of ducking it

- **Status:** Accepted
- **Date:** 2026-11-12

## Context

ADR 0018 plays the timer beeps with `expo-audio` on the media stream, ducking other audio (`interruptionMode: 'duckOthers'`). Music kept getting stuck at the ducked volume after a rest beep, even after we released the focus explicitly after each beep (`setIsAudioActiveAsync(false/true)`).

`dumpsys audio` showed RepTile still owning the audio focus a minute after the beep, until YouTube requested it. The cause is in `expo-audio` 57 (`AudioModule.kt`): on `AUDIOFOCUS_LOSS_TRANSIENT` it sets `focusAcquired = false` without leaving the focus stack, and `releaseAudioFocus()` returns early when that flag is false. When another app takes the focus for a moment (Instagram does it constantly) while a beep holds it, the beep's focus is never abandoned; when that app lets go, Android hands the focus back to RepTile, which then keeps other audio ducked while playing nothing.

Options: patch `expo-audio`'s Kotlin with `patch-package` (always abandon; release on a regained focus when nothing plays), which keeps the ducking but means a native patch to maintain and rebuild on every SDK update; or not request audio focus at all.

## Decision

The beeps use `interruptionMode: 'mixWithOthers'`: `expo-audio` never requests audio focus, so the beep plays over the music without lowering it, and RepTile never sits in the focus stack. The rest of ADR 0018 holds (vibrate-only channels, beep played by the app on the media stream).

## Consequences

- Music is never ducked, so it can't get stuck ducked. No JS focus workaround, no native patch.
- The beep doesn't lower the music while it plays; it's a short, sharp sound on the media stream at the media volume, which is enough to hear over music. If that proves too quiet, the patch above is the way to bring ducking back.
- Other apps no longer see RepTile as an audio focus holder (e.g. they won't pause for a beep).
