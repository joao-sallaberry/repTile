import Storage from 'expo-sqlite/kv-store';

const KEY = 'welcome-seen';

/** Whether the first-launch welcome (which asks for the timer permissions) was already shown on this device. */
export const hasSeenWelcome = () => Storage.getItemSync(KEY) === '1';

export const markWelcomeSeen = () => Storage.setItemSync(KEY, '1');
