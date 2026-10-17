# 0007. Local low-res machine photos

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

Machine names alone ("Powergym do canto esquerdo") are hard to match to the real equipment. A photo helps, but only needs to be good enough to recognise it.

## Decision

- Photos come from the camera or gallery (`expo-image-picker`), are downscaled to 800 px on the longest side, JPEG quality 0.6 (`expo-image-manipulator`), and stored in `<document>/machine-photos/` (`expo-file-system`).
- `machines.photo` stores only the file name, resolved at read time, because the document dir path can change between updates on iOS. File names include a timestamp so cached images refresh; the old file is deleted on replace/remove.
- The microphone permission is removed; the gallery uses the system photo picker (no permission).

## Consequences

- Small files (tens of KB), cheap to store and later upload.
- Photos are device-local: sync will need Supabase Storage, and a reinstall loses them.
