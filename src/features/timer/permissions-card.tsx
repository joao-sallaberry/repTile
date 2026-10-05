import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Button, Card, List } from 'react-native-paper';

import {
  getTimerPermissionStatus,
  openAlarmPermissionSettings,
  openBatteryOptimizationSettings,
  requestNotificationPermission,
  type TimerPermissionStatus,
} from './notifications';

/** Shows which permissions are still needed for timer alerts to work with the screen off. */
export function TimerPermissionsCard() {
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

  if (Platform.OS !== 'android' || !status) return null;
  if (status.notifications && status.exactAlarms && !status.batteryOptimized) return null;

  return (
    <Card mode="outlined">
      <Card.Title title="Avisos do timer" subtitle="Libere para ouvir o fim do descanso com a tela apagada" subtitleNumberOfLines={2} />
      {!status.notifications && (
        <List.Item
          title="Permitir notificações"
          left={(p) => <List.Icon {...p} icon="bell-outline" />}
          right={() => <Button onPress={() => requestNotificationPermission().then(refresh)}>Permitir</Button>}
        />
      )}
      {!status.exactAlarms && (
        <List.Item
          title="Alarmes no horário exato"
          left={(p) => <List.Icon {...p} icon="alarm" />}
          right={() => <Button onPress={openAlarmPermissionSettings}>Abrir</Button>}
        />
      )}
      {status.batteryOptimized && (
        <List.Item
          title="Sem restrição de bateria"
          description="Evita atrasos no modo de economia"
          left={(p) => <List.Icon {...p} icon="battery-alert-variant-outline" />}
          right={() => <Button onPress={openBatteryOptimizationSettings}>Abrir</Button>}
        />
      )}
    </Card>
  );
}
