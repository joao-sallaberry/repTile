import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Button, List, useTheme } from 'react-native-paper';

import {
  getTimerPermissionStatus,
  openAlarmPermissionSettings,
  openBatteryOptimizationSettings,
  requestNotificationPermission,
  type TimerPermissionStatus,
} from './notifications';

/** Current timer permission status, refreshed on focus and when coming back from system settings. */
export function useTimerPermissions() {
  const [status, setStatus] = useState<TimerPermissionStatus | null>(null);
  const refresh = useCallback(() => {
    getTimerPermissionStatus().then(setStatus).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
      return () => sub.remove();
    }, [refresh]),
  );

  return { status, refresh };
}

/** One row per permission the timer alerts need, with its state or a button to grant it. */
export function TimerPermissionsList() {
  const theme = useTheme();
  const { status, refresh } = useTimerPermissions();
  if (Platform.OS !== 'android' || !status) return null;

  const granted = (p: { style?: object }) => <List.Icon {...p} icon="check-circle" color={theme.colors.primary} />;

  return (
    <>
      <List.Item
        title="Notificações"
        description="Mostram o timer e avisam quando ele termina"
        descriptionNumberOfLines={2}
        left={(p) => <List.Icon {...p} icon="bell-outline" />}
        right={(p) =>
          status.notifications ? granted(p) : <Button onPress={() => requestNotificationPermission().then(refresh)}>Permitir</Button>
        }
      />
      <List.Item
        title="Alarmes no horário exato"
        description="O aviso toca no segundo certo, com a tela apagada"
        descriptionNumberOfLines={2}
        left={(p) => <List.Icon {...p} icon="alarm" />}
        right={(p) => (status.exactAlarms ? granted(p) : <Button onPress={openAlarmPermissionSettings}>Abrir</Button>)}
      />
      <List.Item
        title="Sem restrição de bateria"
        description="Evita atrasos no modo de economia"
        descriptionNumberOfLines={2}
        left={(p) => <List.Icon {...p} icon="battery-alert-variant-outline" />}
        right={(p) => (!status.batteryOptimized ? granted(p) : <Button onPress={openBatteryOptimizationSettings}>Abrir</Button>)}
      />
    </>
  );
}
