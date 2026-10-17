import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { Appbar, FAB, List, Text } from 'react-native-paper';

import { useRoutines } from '@/features/home/queries';
import { describeShape, workoutIcon } from '@/features/workouts/blocks';

export default function WorkoutsScreen() {
  const data = useRoutines();

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
            description={describeShape(item.blocks)}
            left={(p) => <List.Icon {...p} icon={workoutIcon(item.blocks.map((b) => b.kind))} />}
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
