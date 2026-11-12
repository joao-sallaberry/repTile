import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import type { CueKind } from './engine';

const SOURCES: Record<'tick' | 'go' | 'end', number> = {
  tick: require('@/assets/sounds/beep_tick.wav'),
  go: require('@/assets/sounds/beep_go.wav'),
  end: require('@/assets/sounds/beep_end.wav'),
};

type Players = Record<keyof typeof SOURCES, AudioPlayer>;

let players: Players | null = null;
/** Resolves once the audio mode is set: a beep never plays before it (it would request audio focus). */
let ready: Promise<unknown> = Promise.resolve();

function getPlayers(): Players {
  if (!players) {
    players = {
      tick: createAudioPlayer(SOURCES.tick),
      go: createAudioPlayer(SOURCES.go),
      end: createAudioPlayer(SOURCES.end),
    };
    // Mix with other audio, never take audio focus (ADR 0022): with focus, expo-audio could keep it after a
    // beep (a transient loss to another app makes it skip abandoning it) and leave the music ducked.
    ready = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: true,
    }).catch((e) => console.warn('[beeps]', e));
  }
  return players;
}

/**
 * Plays a cue's beep on the media stream, so it follows the music to Bluetooth/wired
 * headphones, over it (ADR 0018, ADR 0022); notification sounds don't.
 * `haptics: false` when the notification already vibrates.
 */
export function playCue(kind: CueKind, { haptics = true } = {}) {
  // Tabata rest uses the end beep, so work and rest sound different.
  const p = getPlayers()[kind === 'interval' ? 'go' : kind === 'rest' ? 'end' : kind];
  void ready.then(() => {
    p.seekTo(0);
    p.play();
  });
  if (haptics) void Haptics.impactAsync(kind === 'tick' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);
}
