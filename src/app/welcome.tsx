import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  openAlarmPermissionSettings,
  openBatteryOptimizationSettings,
  requestNotificationPermission,
} from '@/features/timer/notifications';
import { TimerPermissionsList, useTimerPermissions } from '@/features/timer/permissions-list';
import { markWelcomeSeen } from '@/lib/welcome';

/**
 * First-launch screen: explains and asks for the permissions the timer alerts need. The main button asks for the
 * next one still missing, so the three can be granted without hunting for each row.
 */
export default function WelcomeScreen() {
  const permissions = useTimerPermissions();
  const { status, refresh } = permissions;
  const finish = () => {
    markWelcomeSeen();
    router.replace('/');
  };

  const steps = status
    ? [
        { missing: !status.notifications, label: 'Permitir notificações', ask: () => requestNotificationPermission().then(refresh) },
        { missing: !status.exactAlarms, label: 'Permitir alarmes', ask: openAlarmPermissionSettings },
        { missing: status.batteryOptimized, label: 'Tirar restrição de bateria', ask: openBatteryOptimizationSettings },
      ]
    : [];
  const next = steps.find((s) => s.missing);
  const granted = steps.filter((s) => !s.missing).length;

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={require('@/assets/images/icon.png')} style={styles.mascot} contentFit="contain" />
        <View style={styles.intro}>
          <Text variant="headlineMedium" style={styles.center}>
            Bem-vindo ao RepTile
          </Text>
          <Text variant="bodyLarge" style={[styles.center, styles.muted]}>
            Para avisar o fim do descanso e os intervalos do WOD mesmo com a tela apagada, o app precisa de três
            permissões.
          </Text>
        </View>
        <View style={styles.permissions}>
          {steps.length > 0 && (
            <Text variant="labelMedium" style={[styles.muted, styles.count]}>
              {granted} de {steps.length} permitidas
            </Text>
          )}
          <Card mode="contained">
            <TimerPermissionsList {...permissions} />
          </Card>
        </View>
        <Text variant="bodySmall" style={[styles.center, styles.muted]}>
          Sem elas o timer continua funcionando, mas só avisa com o app aberto. Você pode mudar isso depois em Ajustes.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        {next ? (
          <>
            <Button mode="contained" onPress={next.ask} contentStyle={styles.button}>
              {next.label}
            </Button>
            <Button onPress={finish} contentStyle={styles.secondary}>
              {granted === steps.length - 1 ? 'Continuar sem ela' : 'Continuar sem as outras'}
            </Button>
          </>
        ) : (
          <Button mode="contained" onPress={finish} contentStyle={styles.button}>
            Começar
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, gap: 20 },
  mascot: { width: 120, height: 120, alignSelf: 'center', borderRadius: 28 },
  intro: { gap: 8 },
  center: { textAlign: 'center' },
  muted: { opacity: 0.75 },
  footer: { padding: 16, gap: 4 },
  button: { height: 52 },
  secondary: { height: 44 },
  permissions: { gap: 6 },
  count: { textAlign: 'right', paddingHorizontal: 4 },
});
