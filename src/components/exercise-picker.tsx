import { useMemo, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, List, Portal, SegmentedButtons, Searchbar, Text, TextInput } from 'react-native-paper';

import { EQUIPMENT, MEASURES, type Equipment, type Exercise, type Measure } from '@/db/schema';
import { useExercises } from '@/features/workouts/queries';
import {
  EQUIPMENT_LABEL,
  equipmentLabel,
  equipmentText,
  matchesEquipment,
  toggleEquipment,
} from '@/features/workouts/equipment';
import { createExercise } from '@/features/workouts/repo';

export const MEASURE_LABEL: Record<Measure, string> = {
  weight_reps: 'Carga × reps',
  reps: 'Reps',
  time: 'Tempo',
  distance: 'Distância',
  calories: 'Calorias',
};

/** One chip per equipment; several can be picked, and "Nenhum" excludes the others (`toggleEquipment`). */
export function EquipmentChips({ value, onChange }: { value: Equipment[]; onChange: (e: Equipment[]) => void }) {
  return (
    <View style={styles.chips}>
      {EQUIPMENT.map((e) => (
        <Chip key={e} compact selected={value.includes(e)} showSelectedOverlay onPress={() => onChange(toggleEquipment(value, e))}>
          {EQUIPMENT_LABEL[e]}
        </Chip>
      ))}
    </View>
  );
}

/**
 * Horizontal equipment filter: several can be picked, none picked = all.
 * Only lists the equipment some exercise in `exercises` uses.
 */
export function EquipmentFilter({
  exercises,
  value,
  onChange,
  style,
}: {
  exercises: Pick<Exercise, 'equipment'>[];
  value: Equipment[];
  onChange: (v: Equipment[]) => void;
  style?: ViewStyle;
}) {
  const used = EQUIPMENT.filter((e) => value.includes(e) || exercises.some((x) => x.equipment.includes(e)));
  if (used.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={[styles.filter, style]}>
      <Chip selected={value.length === 0} showSelectedOverlay onPress={() => onChange([])}>
        Todos
      </Chip>
      {used.map((e) => (
        <Chip
          key={e}
          selected={value.includes(e)}
          showSelectedOverlay
          onPress={() => onChange(value.includes(e) ? value.filter((v) => v !== e) : [...value, e])}>
          {equipmentLabel(e)}
        </Chip>
      ))}
    </ScrollView>
  );
}

/** Search text + equipment filter. */
export function matchesExercise(e: Exercise, query: string, equipment: Equipment[]) {
  if (!matchesEquipment(e, equipment)) return false;
  const q = normalize(query);
  return !q || normalize(`${e.name} ${e.category}`).includes(q);
}

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onPick: (exerciseId: string) => void;
};

/** Exercise search dialog, with an option to create a new one. */
export function ExercisePicker({ visible, onDismiss, onPick }: Props) {
  const all = useExercises();
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => all.filter((e) => matchesExercise(e, query, equipment)), [all, query, equipment]);

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
              <EquipmentFilter exercises={all} value={equipment} onChange={setEquipment} />
            </Dialog.Content>
            <Dialog.ScrollArea style={styles.scroll}>
              <FlatList
                data={filtered}
                keyExtractor={(e) => e.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <List.Item
                    title={item.name}
                    description={`${item.category} · ${equipmentText(item)}`}
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
  const [equipment, setEquipment] = useState<Equipment[]>(['none']);

  return (
    <>
      <Dialog.Content style={styles.form}>
        <TextInput mode="outlined" label="Nome" value={name} onChangeText={setName} />
        <TextInput mode="outlined" label="Categoria (ex.: Pernas)" value={category} onChangeText={setCategory} />
        <Text variant="labelLarge">Equipamento</Text>
        <EquipmentChips value={equipment} onChange={setEquipment} />
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
            onCreated(await createExercise({ name: name.trim(), category: category.trim() || 'Outros', measure, equipment }))
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  // A horizontal ScrollView next to a flex list gets squeezed to nothing unless it can't shrink.
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filter: { gap: 6, paddingTop: 8, alignItems: 'center' },
});

