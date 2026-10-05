import { AppState, Platform, type AppStateStatus } from 'react-native';
import notifee, {
  AlarmType,
  AndroidCategory,
  AndroidForegroundServiceType,
  AndroidImportance,
  AndroidNotificationSetting,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
  TriggerType,
  type Event,
} from 'react-native-notify-kit';

import { formatDuration } from '@/lib/format';

import { computeTimer, endsAt, timerCues, workStartsAt } from './engine';
import { ensureTimerHydrated, useTimerStore, type ActiveTimer } from './store';

/**
 * Timer notifications on Android:
 *
 * - While a timer is active, a *foreground service* shows an ongoing notification with
 *   Android's native chronometer (keeps counting even if JS is suspended) and action buttons.
 * - When the app goes to the background (or the screen turns off), we schedule AlarmManager
 *   notifications for the end of the timer and for each new interval — they beep even when
 *   the phone is in Doze or the app has been killed.
 * - While the app is open, those scheduled notifications are cancelled and the beeps come
 *   from the app itself (see `cue-player.ts`), so nothing plays twice.
 */

const CHANNEL_ONGOING = 'timer-ongoing';
const CHANNEL_END = 'timer-end';
const CHANNEL_CUE = 'timer-cue';

const ONGOING_ID = 'timer-ongoing';
const END_ID = 'timer-end';
const CUE_PREFIX = 'timer-cue-';
/** Max cues scheduled at once (Android limits alarms per app). */
const MAX_SCHEDULED_CUES = 60;

export const TIMER_ACTIONS = { add30: 'add30', skip: 'skip', toggle: 'toggle' } as const;

const isAndroid = Platform.OS === 'android';

export async function setupNotificationChannels() {
  if (!isAndroid) return;
  await notifee.createChannels([
    {
      id: CHANNEL_ONGOING,
      name: 'Timer em andamento',
      description: 'Contagem do timer enquanto você treina',
      importance: AndroidImportance.LOW,
      visibility: AndroidVisibility.PUBLIC,
    },
    {
      id: CHANNEL_END,
      name: 'Fim do timer',
      description: 'Aviso quando o descanso ou o WOD termina',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'beep_end',
      vibration: true,
      vibrationPattern: [300, 400, 200, 400],
      bypassDnd: true,
    },
    {
      id: CHANNEL_CUE,
      name: 'Bipes de intervalo',
      description: 'Bipe a cada novo intervalo (EMOM) e no início do WOD',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'beep_go',
      vibration: true,
      vibrationPattern: [300, 300],
    },
  ]);
}

export type TimerPermissionStatus = {
  notifications: boolean;
  exactAlarms: boolean;
  batteryOptimized: boolean;
};

export async function getTimerPermissionStatus(): Promise<TimerPermissionStatus> {
  const settings = await notifee.getNotificationSettings();
  return {
    notifications: settings.authorizationStatus === AuthorizationStatus.AUTHORIZED,
    exactAlarms: !isAndroid || settings.android.alarm === AndroidNotificationSetting.ENABLED,
    batteryOptimized: isAndroid ? await notifee.isBatteryOptimizationEnabled() : false,
  };
}

export async function requestNotificationPermission() {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
}

export const openAlarmPermissionSettings = () => notifee.openAlarmPermissionSettings();
export const openBatteryOptimizationSettings = () => notifee.openBatteryOptimizationSettings();

// ---------------------------------------------------------------------------

function isRest(timer: ActiveTimer) {
  return timer.spec.kind === 'rest';
}

function describeSpec(timer: ActiveTimer): string {
  const { spec } = timer;
  switch (spec.kind) {
    case 'rest':
      return 'Descanso';
    case 'amrap':
      return `AMRAP ${formatDuration(spec.durationSec)}`;
    case 'emom':
      return `EMOM ${spec.rounds} × ${formatDuration(spec.intervalSec)}`;
    case 'for_time':
      return spec.timeCapSec ? `For Time · cap ${formatDuration(spec.timeCapSec)}` : 'For Time';
  }
}

async function showOngoing(timer: ActiveTimer) {
  const now = Date.now();
  const snap = computeTimer(timer.spec, timer.clock, now);
  const paused = timer.clock.pausedAt != null;
  const end = endsAt(timer.spec, timer.clock);
  const countsUp = timer.spec.kind === 'for_time';

  const actions = isRest(timer)
    ? [
        { title: '+30s', pressAction: { id: TIMER_ACTIONS.add30 } },
        { title: 'Pular', pressAction: { id: TIMER_ACTIONS.skip } },
      ]
    : [{ title: paused ? 'Retomar' : 'Pausar', pressAction: { id: TIMER_ACTIONS.toggle } }];

  await notifee.displayNotification({
    id: ONGOING_ID,
    title: timer.label,
    body: paused ? `Pausado · ${formatDuration(snap.displaySec)}` : describeSpec(timer),
    android: {
      channelId: CHANNEL_ONGOING,
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE],
      ongoing: true,
      onlyAlertOnce: true,
      category: AndroidCategory.PROGRESS,
      visibility: AndroidVisibility.PUBLIC,
      pressAction: { id: 'default', launchActivity: 'default' },
      actions,
      ...(paused
        ? { showChronometer: false }
        : countsUp
          ? { showChronometer: true, chronometerDirection: 'up' as const, timestamp: workStartsAt(timer.clock) }
          : { showChronometer: true, chronometerDirection: 'down' as const, timestamp: end ?? now }),
    },
  });
}

async function cancelScheduled() {
  const ids = await notifee.getTriggerNotificationIds();
  const ours = ids.filter((id) => id === END_ID || id.startsWith(CUE_PREFIX));
  if (ours.length) await notifee.cancelTriggerNotifications(ours);
}

async function scheduleBackgroundAlerts(timer: ActiveTimer) {
  const end = endsAt(timer.spec, timer.clock);
  if (end == null && timer.spec.kind !== 'for_time') return;

  const { exactAlarms } = await getTimerPermissionStatus();
  const alarmManager = {
    // SET_ALARM_CLOCK is the only type that fires on time even in deep Doze.
    type: exactAlarms ? AlarmType.SET_ALARM_CLOCK : AlarmType.SET_AND_ALLOW_WHILE_IDLE,
  };
  const pressAction = { id: 'default', launchActivity: 'default' };
  const now = Date.now();

  if (end != null && end > now) {
    await notifee.createTriggerNotification(
      {
        id: END_ID,
        title: isRest(timer) ? 'Descanso terminou!' : 'Tempo!',
        body: isRest(timer) ? `${timer.label} · próxima série` : timer.label,
        android: {
          channelId: CHANNEL_END,
          category: AndroidCategory.ALARM,
          importance: AndroidImportance.HIGH,
          pressAction,
          autoCancel: true,
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: end, alarmManager },
    );
  }

  // "Go!" and each new EMOM interval (the short 3-2-1 beeps only play in the app).
  const base = timer.clock.startedAt + timer.clock.pausedTotalMs;
  const cues = timerCues(timer.spec, timer.clock)
    .filter((c) => c.kind === 'go' || c.kind === 'interval')
    .map((c, i) => ({ ...c, i, at: base + c.atSec * 1000 }))
    .filter((c) => c.at > now + 500)
    .slice(0, MAX_SCHEDULED_CUES);

  for (const cue of cues) {
    const snap = computeTimer(timer.spec, timer.clock, cue.at + 1);
    await notifee.createTriggerNotification(
      {
        id: `${CUE_PREFIX}${cue.i}`,
        title: cue.kind === 'go' ? 'Vai!' : `Round ${snap.round}/${snap.roundCount}`,
        body: timer.label,
        android: {
          channelId: CHANNEL_CUE,
          importance: AndroidImportance.HIGH,
          pressAction,
          autoCancel: true,
          timeoutAfter: 5000,
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: cue.at, alarmManager },
    );
  }
}

async function render(timer: ActiveTimer | null, appState: AppStateStatus) {
  if (!timer || computeTimer(timer.spec, timer.clock, Date.now()).phase === 'done') {
    await notifee.stopForegroundService();
    await notifee.cancelNotification(ONGOING_ID);
    if (!timer) await cancelScheduled();
    return;
  }
  await showOngoing(timer);
  await cancelScheduled();
  if (appState !== 'active' && timer.clock.pausedAt == null) {
    await scheduleBackgroundAlerts(timer);
  }
}

// Serialize updates so rapid changes (e.g. pause/resume) don't race each other.
let queue: Promise<void> = Promise.resolve();
export function refreshTimerNotifications() {
  if (!isAndroid) return;
  queue = queue
    .then(() => render(useTimerStore.getState().active, AppState.currentState))
    .catch((e) => console.warn('[timer notifications]', e));
}

export async function handleTimerEvent({ type, detail }: Event) {
  if (type === EventType.ACTION_PRESS) {
    await ensureTimerHydrated();
    const timer = useTimerStore.getState();
    switch (detail.pressAction?.id) {
      case TIMER_ACTIONS.add30:
        timer.addSeconds(30);
        break;
      case TIMER_ACTIONS.skip:
        timer.stop();
        break;
      case TIMER_ACTIONS.toggle:
        timer.togglePause();
        break;
    }
  } else if (type === EventType.DELIVERED && detail.notification?.id === END_ID) {
    await ensureTimerHydrated();
    const active = useTimerStore.getState().active;
    // Rest is over: stop the timer. WOD is over: keep it so the user can log the result.
    if (active && isRest(active)) useTimerStore.getState().stop();
    else refreshTimerNotifications();
  }
}

let started = false;

/**
 * Registers the foreground service and keeps notifications in sync with the active timer.
 * Called once from the app entry point (`index.ts`), including in the background.
 */
export function startTimerNotifications() {
  if (started || !isAndroid) return;
  started = true;

  // The service task stays pending until `stopForegroundService()` is called.
  notifee.registerForegroundService(() => new Promise<void>(() => {}));
  notifee.onBackgroundEvent(handleTimerEvent);
  notifee.onForegroundEvent((event) => void handleTimerEvent(event));

  void setupNotificationChannels();
  useTimerStore.subscribe((s, prev) => {
    if (s.active !== prev.active) refreshTimerNotifications();
  });
  AppState.addEventListener('change', refreshTimerNotifications);
  void ensureTimerHydrated().then(refreshTimerNotifications);
}
