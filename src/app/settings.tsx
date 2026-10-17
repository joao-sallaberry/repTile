import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { Card, List, Text } from 'react-native-paper';

import { TimerPermissionsList } from '@/features/timer/permissions-list';

export default function SettingsScreen() {
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
});
