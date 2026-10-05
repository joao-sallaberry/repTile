import { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Button, Dialog, List, Portal, SegmentedButtons, Searchbar, Text, TextInput } from 'react-native-paper';

import { MEASURES, type Measure } from '@/db/schema';
import { useExercises } from '@/features/workouts/queries';
import { createExercise } from '@/features/workouts/repo';

export const MEASURE_LABEL: Record<Measure, string> = {
  weight_reps: 'Carga × reps',
  reps: 'Reps',
  time: 'Tempo',
  distance: 'Distância',
  calories: 'Calorias',
};

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onPick: (exerciseId: string) => void;
};

/** Exercise search dialog, with an option to create a new one. */
export function ExercisePicker({ visible, onDismiss, onPick }: Props) {
  const all = useExercises();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return q ? all.filter((e) => normalize(`${e.name} ${e.category}`).includes(q)) : all;
  }, [all, query]);

  const pick = (id: string) => {
    onPick(id);
    setQuery('');
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{creating ? 'Novo exercício' : 'Escolher exercício'}</Dialog.Title>
        {creating ? (
          <NewExerciseForm
            initialName={query}
            onCancel={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false);
              pick(id);
            }}
          />
        ) : (
          <>
            <Dialog.Content>
              <Searchbar placeholder="Buscar" value={query} onChangeText={setQuery} autoFocus={false} />
            </Dialog.Content>
            <Dialog.ScrollArea style={styles.scroll}>
              <FlatList
                data={filtered}
                keyExtractor={(e) => e.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <List.Item
                    title={item.name}
                    description={`${item.category} · ${MEASURE_LABEL[item.measure]}`}
                    onPress={() => pick(item.id)}
                  />
                )}
                ListEmptyComponent={<Text style={styles.empty}>Nenhum exercício encontrado</Text>}
              />
            </Dialog.ScrollArea>
            <Dialog.Actions>
              <Button onPress={() => setCreating(true)}>Criar novo</Button>
              <Button onPress={onDismiss}>Fechar</Button>
            </Dialog.Actions>
          </>
        )}
      </Dialog>
    </Portal>
  );
}

export function NewExerciseForm({
  initialName = '',
  onCancel,
  onCreated,
}: {
  initialName?: string;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState('');
  const [measure, setMeasure] = useState<Measure>('weight_reps');

  return (
    <>
      <Dialog.Content style={styles.form}>
        <TextInput mode="outlined" label="Nome" value={name} onChangeText={setName} />
        <TextInput mode="outlined" label="Categoria (ex.: Pernas)" value={category} onChangeText={setCategory} />
        <Text variant="labelLarge">Como medir</Text>
        <SegmentedButtons
          value={measure}
          onValueChange={(v) => setMeasure(v as Measure)}
          density="small"
          buttons={MEASURES.slice(0, 3).map((m) => ({ value: m, label: MEASURE_LABEL[m] }))}
        />
        <SegmentedButtons
          value={measure}
          onValueChange={(v) => setMeasure(v as Measure)}
          density="small"
          buttons={MEASURES.slice(3).map((m) => ({ value: m, label: MEASURE_LABEL[m] }))}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onCancel}>Cancelar</Button>
        <Button
          disabled={!name.trim()}
          onPress={async () =>
            onCreated(await createExercise({ name: name.trim(), category: category.trim() || 'Outros', measure }))
          }>
          Criar
        </Button>
      </Dialog.Actions>
    </>
  );
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const styles = StyleSheet.create({
  dialog: { maxHeight: '85%' },
  scroll: { paddingHorizontal: 0, maxHeight: 420 },
  empty: { padding: 24, textAlign: 'center' },
  form: { gap: 12 },
});

