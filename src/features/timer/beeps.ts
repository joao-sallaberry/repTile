import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import type { CueKind } from './engine';

const SOURCES: Record<'tick' | 'go' | 'end', number> = {
  tick: require('@/assets/sounds/beep_tick.wav'),
  go: require('@/assets/sounds/beep_go.wav'),
  end: require('@/assets/sounds/beep_end.wav'),
};

type Players = Record<keyof typeof SOURCES, AudioPlayer>;

let players: Players | null = null;
/**
 * Every audio call goes through this chain, so a beep never starts before the audio mode is
 * set (the first one would grab exclusive focus instead of ducking) or while focus is released.
 */
let chain: Promise<unknown> = Promise.resolve();

function enqueue(step: () => unknown) {
  chain = chain.then(step).catch((e) => console.warn('[beeps]', e));
}

function getPlayers(): Players {
  if (!players) {
    const created: Players = {
      tick: createAudioPlayer(SOURCES.tick),
      go: createAudioPlayer(SOURCES.go),
      end: createAudioPlayer(SOURCES.end),
    };
    for (const p of Object.values(created)) {
      p.addListener('playbackStatusUpdate', (s) => {
        if (s.didJustFinish) enqueue(releaseFocus);
      });
    }
    players = created;
    enqueue(() => setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: true }));
  }
  return players;
}

/**
 * Gives the audio focus back once no beep is playing, so ducked music returns to full volume.
 * expo-audio only does it from its own playback callback, which left other apps ducked.
 */
async function releaseFocus() {
  if (Object.values(getPlayers()).some((p) => p.playing)) return;
  await setIsAudioActiveAsync(false);
  await setIsAudioActiveAsync(true);
}

/**
 * Plays a cue's beep on the media stream, so it follows the music to Bluetooth/wired
 * headphones (ducking it); notification sounds don't (ADR 0018).
 * `haptics: false` when the notification already vibrates.
 */
export function playCue(kind: CueKind, { haptics = true } = {}) {
  // Tabata rest uses the end beep, so work and rest sound different.
  const p = getPlayers()[kind === 'interval' ? 'go' : kind === 'rest' ? 'end' : kind];
  enqueue(() => {
    p.seekTo(0);
    p.play();
  });
  if (haptics) void Haptics.impactAsync(kind === 'tick' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);
}
