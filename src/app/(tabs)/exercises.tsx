import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Appbar, Dialog, FAB, List, Portal, Searchbar } from 'react-native-paper';

import { MEASURE_LABEL, NewExerciseForm } from '@/components/exercise-picker';
import type { Exercise } from '@/db/schema';
import { useExercises } from '@/features/workouts/queries';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function ExercisesScreen() {
  const all = useExercises();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const sections = useMemo(() => {
    const q = normalize(query);
    const groups = new Map<string, Exercise[]>();
    for (const e of all) {
      if (q && !normalize(`${e.name} ${e.category}`).includes(q)) continue;
      groups.set(e.category, [...(groups.get(e.category) ?? []), e]);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [all, query]);

  return (
    <View style={styles.flex}>
      <Appbar.Header>
        <Appbar.Content title="Exercícios e PRs" />
      </Appbar.Header>
      <Searchbar placeholder="Buscar exercício" value={query} onChangeText={setQuery} style={styles.search} />
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => <List.Subheader>{section.title}</List.Subheader>}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={MEASURE_LABEL[item.measure]}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.id } })}
          />
        )}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setCreating(true)} />
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
  list: { paddingBottom: 96 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
