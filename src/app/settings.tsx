import { router } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, List, Switch, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { SET_TYPE_COLORS } from '@/components/set-badge';
import { HealthSettings } from '@/features/health/health-settings';
import { plural } from '@/features/history/session-card';
import { useWeeklyGoal } from '@/features/home/goal';
import { useLocations, useMachineMap } from '@/features/places/queries';
import { useSessionPreferences } from '@/features/session/preferences';
import { TimerPermissionsList, useTimerPermissions } from '@/features/timer/permissions-list';

const GOALS = [1, 2, 3, 4, 5, 6, 7];

export default function SettingsScreen() {
  const theme = useTheme();
  const { goal, set: setGoal } = useWeeklyGoal();
  const { restAfterWarmup, setRestAfterWarmup } = useSessionPreferences();
  const { status } = useTimerPermissions();
  const locations = useLocations();
  const machineMap = useMachineMap();
  const machineCount = [...machineMap.values()].filter((m) => m.deletedAt == null).length;
  // Timer permissions still to grant (Android only; null while loading).
  const missing = status ? [!status.notifications, !status.exactAlarms, status.batteryOptimized].filter(Boolean).length : 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="titleMedium">Treino</Text>
      <Card mode="contained">
        <View style={styles.goal}>
          <View style={styles.goalHeader}>
            <View style={styles.flex}>
              <Text variant="bodyLarge">Meta semanal</Text>
              <Text variant="bodyMedium" style={styles.muted}>
                {goal ? `${plural(goal, 'treino', 'treinos')} de segunda a domingo` : 'Sem meta na tela inicial'}
              </Text>
            </View>
            <Button disabled={goal == null} onPress={() => setGoal(null)}>
              Sem meta
            </Button>
          </View>
          <View style={styles.goalRow} accessibilityRole="radiogroup" accessibilityLabel="Treinos por semana">
            {GOALS.map((g) => (
              <TouchableRipple
                key={g}
                borderless
                accessibilityRole="radio"
                accessibilityState={{ selected: goal === g }}
                accessibilityLabel={`${g} por semana`}
                onPress={() => setGoal(g)}
                style={[
                  styles.goalButton,
                  goal === g ? { backgroundColor: theme.colors.primary } : { borderWidth: 1, borderColor: theme.colors.outline },
                ]}>
                <Text variant="titleMedium" style={{ color: goal === g ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}>
                  {g}
                </Text>
              </TouchableRipple>
            ))}
          </View>
        </View>
        <Divider />
        <List.Item
          title="Descanso após aquecimento"
          description={
            restAfterWarmup
              ? 'Séries de aquecimento também iniciam o descanso'
              : 'Só as séries de trabalho iniciam o descanso'
          }
          descriptionNumberOfLines={2}
          left={(p) => <List.Icon {...p} icon="fire" />}
          right={() => <Switch value={restAfterWarmup} onValueChange={setRestAfterWarmup} />}
          onPress={() => setRestAfterWarmup(!restAfterWarmup)}
        />
        <Divider />
        <List.Item
          title="Locais e máquinas"
          description={`${plural(locations.length, 'local', 'locais')} · ${plural(machineCount, 'máquina', 'máquinas')}`}
          left={(p) => <List.Icon {...p} icon="map-marker-outline" />}
          right={(p) => <List.Icon {...p} icon="chevron-right" />}
          onPress={() => router.push('/locations')}
        />
      </Card>

      <View style={[styles.sectionHeader, styles.section]}>
        <Text variant="titleMedium" style={styles.flex}>
          Avisos do timer
        </Text>
        {status && (
          <Text
            variant="labelSmall"
            style={[
              styles.badge,
              missing
                ? { backgroundColor: SET_TYPE_COLORS.warmup.bg, color: SET_TYPE_COLORS.warmup.fg }
                : { backgroundColor: theme.colors.tertiaryContainer, color: theme.colors.onTertiaryContainer },
            ]}>
            {missing ? `${missing === 1 ? 'falta' : 'faltam'} ${missing} de 3` : 'tudo certo'}
          </Text>
        )}
      </View>
      <Text variant="bodySmall" style={styles.muted}>
        Necessárias para ouvir o fim do descanso e os intervalos do WOD com a tela apagada.
      </Text>
      <Card mode="contained">
        <TimerPermissionsList />
      </Card>

      <Text variant="titleMedium" style={styles.section}>
        Google Health
      </Text>
      <Text variant="bodySmall" style={styles.muted}>
        Mostra a frequência cardíaca e as calorias do relógio (Fitbit, Pixel Watch) em cada treino, lidas do Health
        Connect.
      </Text>
      <Card mode="contained">
        <HealthSettings />
      </Card>

      <Text variant="titleMedium" style={styles.section}>
        Créditos
      </Text>
      <Card mode="contained">
        {/* Required by the RepDB free-tier license (ADR 0016): keep this visible link. */}
        <List.Item
          title="Ilustrações dos exercícios"
          description="Exercise data by RepDB (repdb.co)"
          left={(p) => <List.Icon {...p} icon="image-outline" />}
          right={(p) => <List.Icon {...p} icon="open-in-new" />}
          onPress={() => Linking.openURL('https://repdb.co')}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: 48 },
  muted: { opacity: 0.7, marginBottom: 4 },
  section: { marginTop: 16 },
  flex: { flex: 1 },
  goal: { padding: 16, gap: 12 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalRow: { flexDirection: 'row', gap: 6 },
  goalButton: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
});
