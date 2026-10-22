import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import type { CueKind } from './engine';

const SOURCES: Record<'tick' | 'go' | 'end', number> = {
  tick: require('@/assets/sounds/beep_tick.wav'),
  go: require('@/assets/sounds/beep_go.wav'),
  end: require('@/assets/sounds/beep_end.wav'),
};

let players: Record<keyof typeof SOURCES, AudioPlayer> | null = null;

function getPlayers() {
  if (!players) {
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: true });
    players = {
      tick: createAudioPlayer(SOURCES.tick),
      go: createAudioPlayer(SOURCES.go),
      end: createAudioPlayer(SOURCES.end),
    };
  }
  return players;
}

/**
 * Plays a cue's beep on the media stream, so it follows the music to Bluetooth/wired
 * headphones (ducking it); notification sounds don't (ADR 0018).
 * `haptics: false` when the notification already vibrates.
 */
export function playCue(kind: CueKind, { haptics = true } = {}) {
  // Tabata rest uses the end beep, so work and rest sound different.
  const p = getPlayers()[kind === 'interval' ? 'go' : kind === 'rest' ? 'end' : kind];
  p.seekTo(0);
  p.play();
  if (haptics) void Haptics.impactAsync(kind === 'tick' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);
}
