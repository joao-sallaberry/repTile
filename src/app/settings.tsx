import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, List, Text } from 'react-native-paper';

import { useWeeklyGoal } from '@/features/home/goal';
import { TimerPermissionsList } from '@/features/timer/permissions-list';

const GOALS = [null, 1, 2, 3, 4, 5, 6, 7];

export default function SettingsScreen() {
  const { goal, set: setGoal } = useWeeklyGoal();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="titleMedium">Avisos do timer</Text>
      <Text variant="bodySmall" style={styles.muted}>
        Necessárias para ouvir o fim do descanso e os intervalos do WOD com a tela apagada.
      </Text>
      <Card mode="contained">
        <TimerPermissionsList />
      </Card>

      <Text variant="titleMedium" style={styles.section}>
        Treino
      </Text>
      <Text variant="bodySmall" style={styles.muted}>
        Meta semanal: quantos treinos por semana (de segunda a domingo) aparecem na tela inicial.
      </Text>
      <View style={styles.chips}>
        {GOALS.map((g) => (
          <Chip key={g ?? 'none'} selected={goal === g} showSelectedCheck={false} onPress={() => setGoal(g)}>
            {g ?? 'Sem meta'}
          </Chip>
        ))}
      </View>
      <Card mode="contained">
        <List.Item
          title="Locais e máquinas"
          left={(p) => <List.Icon {...p} icon="map-marker-outline" />}
          right={(p) => <List.Icon {...p} icon="chevron-right" />}
          onPress={() => router.push('/locations')}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: 48 },
  muted: { opacity: 0.7, marginBottom: 4 },
  section: { marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
});
