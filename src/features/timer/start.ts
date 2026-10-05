import { Platform } from 'react-native';

import { requestNotificationPermission } from './notifications';
import { useTimerStore } from './store';

type StartInput = Parameters<ReturnType<typeof useTimerStore.getState>['start']>[0];

let asked = false;

/** Starts a timer, asking for notification permission the first time (Android 13+). */
export function startTimer(input: StartInput) {
  if (!asked && Platform.OS === 'android') {
    asked = true;
    void requestNotificationPermission().catch(() => {});
  }
  useTimerStore.getState().start(input);
}
