import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Appbar, Dialog, List, Portal, Searchbar, Text } from 'react-native-paper';

import { ExerciseThumb } from '@/components/exercise-media';
import { EquipmentFilter, matchesExercise, MEASURE_LABEL, NewExerciseForm } from '@/components/exercise-picker';
import { PrimaryFab } from '@/components/primary-fab';
import type { Equipment, Exercise } from '@/db/schema';
import { equipmentText } from '@/features/workouts/equipment';
import { useExercises } from '@/features/workouts/queries';

export default function ExercisesScreen() {
  const all = useExercises();
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [creating, setCreating] = useState(false);

  const sections = useMemo(() => {
    const groups = new Map<string, Exercise[]>();
    for (const e of all) {
      if (!matchesExercise(e, query, equipment)) continue;
      groups.set(e.category, [...(groups.get(e.category) ?? []), e]);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [all, query, equipment]);

  return (
    <View style={styles.flex}>
      <Appbar.Header>
        <Appbar.Content title="Exercícios e PRs" />
      </Appbar.Header>
      <Searchbar placeholder="Buscar exercício" value={query} onChangeText={setQuery} style={styles.search} />
      <EquipmentFilter exercises={all} value={equipment} onChange={setEquipment} style={styles.filter} />
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum exercício encontrado</Text>}
        renderSectionHeader={({ section }) => <List.Subheader>{section.title}</List.Subheader>}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={`${equipmentText(item)} · ${MEASURE_LABEL[item.measure]}`}
            left={(p) => <ExerciseThumb exerciseId={item.id} equipment={item.equipment[0]} style={p.style} />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.id } })}
          />
        )}
      />
      <PrimaryFab icon="plus" accessibilityLabel="Novo exercício" onPress={() => setCreating(true)} />
      <Portal>
        <Dialog visible={creating} onDismiss={() => setCreating(false)}>
          <Dialog.Title>Novo exercício</Dialog.Title>
          <NewExerciseForm initialName={query} onCancel={() => setCreating(false)} onCreated={() => setCreating(false)} />
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { marginHorizontal: 16, marginBottom: 8 },
  filter: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 8 },
  empty: { padding: 24, textAlign: 'center', opacity: 0.7 },
  list: { paddingBottom: 96 },
});
