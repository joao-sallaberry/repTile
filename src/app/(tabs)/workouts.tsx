import { desc, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { Appbar, FAB, List, Text } from 'react-native-paper';

import { db } from '@/db/client';
import { workouts } from '@/db/schema';
import { WORKOUT_TYPE_ICON, WORKOUT_TYPE_LABEL } from '@/theme';

export default function WorkoutsScreen() {
  const { data } = useLiveQuery(
    db.select().from(workouts).where(isNull(workouts.deletedAt)).orderBy(desc(workouts.updatedAt)),
  );

  return (
    <View style={styles.flex}>
      <Appbar.Header>
        <Appbar.Content title="Treinos" />
      </Appbar.Header>
      <FlatList
        data={data}
        keyExtractor={(w) => w.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={WORKOUT_TYPE_LABEL[item.type]}
            left={(p) => <List.Icon {...p} icon={WORKOUT_TYPE_ICON[item.type]} />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="titleMedium">Nenhum treino ainda</Text>
            <Text variant="bodyMedium">Toque em + para cadastrar seu primeiro treino.</Text>
          </View>
        }
      />
      <FAB icon="plus" label="Novo treino" style={styles.fab} onPress={() => router.push('/workout/edit')} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 96 },
  empty: { alignItems: 'center', padding: 32, gap: 8 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
