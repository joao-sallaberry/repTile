import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { runningMs, timerCues, type CueKind } from './engine';
import { refreshTimerNotifications } from './notifications';
import { useTimerStore } from './store';

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

export function playCue(kind: CueKind) {
  // Tabata rest uses the end beep, so work and rest sound different.
  const p = getPlayers()[kind === 'interval' ? 'go' : kind === 'rest' ? 'end' : kind];
  p.seekTo(0);
  p.play();
  void Haptics.impactAsync(kind === 'tick' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);
}

/** Skip cues missed by more than this (e.g. the app came back from the background). */
const STALE_MS = 1500;

/**
 * Plays the active timer's beeps while the app is open.
 * In the background the beeps come from scheduled notifications (see notifications.ts).
 */
export function useTimerCuePlayer() {
  const active = useTimerStore((s) => s.active);

  useEffect(() => {
    if (!active || active.clock.pausedAt != null) return;
    const cues = timerCues(active.spec, active.clock);
    let lastMs = runningMs(active.clock, Date.now());

    const id = setInterval(() => {
      const nowMs = runningMs(active.clock, Date.now());
      const foreground = AppState.currentState === 'active';
      for (const cue of cues) {
        const at = cue.atSec * 1000;
        if (at > lastMs && at <= nowMs) {
          if (foreground && nowMs - at < STALE_MS) playCue(cue.kind);
          if (cue.kind === 'end') {
            if (active.spec.kind === 'rest') useTimerStore.getState().stop();
            else refreshTimerNotifications();
          }
        }
      }
      lastMs = nowMs;
    }, 100);
    return () => clearInterval(id);
  }, [active]);
}
