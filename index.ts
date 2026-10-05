// Entry point: registers the notification handlers and the timer foreground service
// before the app (they must also exist when the app is woken up in the background).
import { startTimerNotifications } from '@/features/timer/notifications';

startTimerNotifications();

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('expo-router/entry');
