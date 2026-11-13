import { useMemo, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Dialog, List, Portal, SegmentedButtons, Searchbar, Text, TextInput } from 'react-native-paper';

import { ExerciseThumb } from '@/components/exercise-media';
import { FilterChip } from '@/components/filter-chips';
import { EQUIPMENT, MEASURES, type Equipment, type Exercise, type Measure } from '@/db/schema';
import { recentExerciseIds } from '@/features/stats/exercise-list';
import { useExerciseMarks } from '@/features/stats/queries';
import { useExercises } from '@/features/workouts/queries';
import {
  EQUIPMENT_LABEL,
  equipmentLabel,
  equipmentText,
  matchesEquipment,
  toggleEquipment,
} from '@/features/workouts/equipment';
import { createExercise } from '@/features/workouts/repo';
import { normalizeSearch as normalize } from '@/lib/search';

export const MEASURE_LABEL: Record<Measure, string> = {
  weight_reps: 'Carga × reps',
  reps: 'Reps',
  time: 'Tempo',
  distance: 'Distância',
  calories: 'Calorias',
};

/** One chip per equipment; several can be picked (`toggleEquipment`), "Livre" included. */
export function EquipmentChips({ value, onChange }: { value: Equipment[]; onChange: (e: Equipment[]) => void }) {
  return (
    <View style={styles.chips}>
      {EQUIPMENT.map((e) => (
        <FilterChip key={e} compact selected={value.includes(e)} onPress={() => onChange(toggleEquipment(value, e))}>
          {EQUIPMENT_LABEL[e]}
        </FilterChip>
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
  label,
  style,
}: {
  exercises: Pick<Exercise, 'equipment'>[];
  value: Equipment[];
  onChange: (v: Equipment[]) => void;
  label?: string;
  style?: ViewStyle;
}) {
  const used = EQUIPMENT.filter((e) => value.includes(e) || exercises.some((x) => x.equipment.includes(e)));
  return <ChipFilter options={used.map((e) => ({ key: e, label: equipmentLabel(e) }))} value={value} onChange={onChange} label={label} style={style} />;
}

/** Muscle groups (the exercises' categories), in alphabetical order. */
export const exerciseCategories = (exercises: Pick<Exercise, 'category'>[]) =>
  [...new Set(exercises.map((e) => e.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

/** Horizontal muscle group filter: several can be picked, none picked = all. */
export function CategoryFilter({
  exercises,
  value,
  onChange,
  label,
  style,
}: {
  exercises: Pick<Exercise, 'category'>[];
  value: string[];
  onChange: (v: string[]) => void;
  label?: string;
  style?: ViewStyle;
}) {
  const options = exerciseCategories(exercises).map((c) => ({ key: c, label: c }));
  return <ChipFilter options={options} value={value} onChange={onChange} label={label} style={style} />;
}

/** "Todos" plus one multi-select chip per option; hidden when there is no choice to make. */
function ChipFilter<K extends string>({
  options,
  value,
  onChange,
  label,
  style,
}: {
  options: { key: K; label: string }[];
  value: K[];
  onChange: (v: K[]) => void;
  label?: string;
  style?: ViewStyle;
}) {
  if (options.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={[styles.filter, style]}>
      {label && (
        <Text variant="labelSmall" style={styles.filterLabel}>
          {label}
        </Text>
      )}
      <FilterChip selected={value.length === 0} onPress={() => onChange([])}>
        Todos
      </FilterChip>
      {options.map((o) => (
        <FilterChip
          key={o.key}
          selected={value.includes(o.key)}
          onPress={() => onChange(value.includes(o.key) ? value.filter((v) => v !== o.key) : [...value, o.key])}>
          {o.label}
        </FilterChip>
      ))}
    </ScrollView>
  );
}

/** Search text + equipment and muscle group filters (an empty filter matches everything). */
export function matchesExercise(e: Exercise, query: string, equipment: Equipment[], categories: string[] = []) {
  if (!matchesEquipment(e, equipment)) return false;
  if (categories.length && !categories.includes(e.category)) return false;
  const q = normalize(query);
  return !q || normalize(`${e.name} ${e.category}`).includes(q);
}

type Props = {
  visible: boolean;
  onDismiss: () => void;
  /** The exercises picked, in the order they were tapped. */
  onPick: (exerciseIds: string[]) => void;
};

type PickerRow = { key: string; exercise: Exercise };

/**
 * Exercise search dialog: several exercises can be ticked and added at once ("Adicionar 2"), the ones used in
 * the last two weeks come first, and a new one can be created (it joins the selection).
 */
export function ExercisePicker({ visible, onDismiss, onPick }: Props) {
  const all = useExercises();
  const [now] = useState(() => Date.now());
  const marks = useExerciseMarks(now);
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const sections = useMemo((): { title: string | null; data: PickerRow[] }[] => {
    const rows: PickerRow[] = all.filter((e) => matchesExercise(e, query, equipment)).map((e) => ({ key: e.id, exercise: e }));
    if (query.trim() || equipment.length) return [{ title: null, data: rows }];
    const byId = new Map(all.map((e) => [e.id, e]));
    const recent = recentExerciseIds(marks, now, 14).flatMap((id) => {
      const exercise = byId.get(id);
      return exercise ? [{ key: `recent:${id}`, exercise }] : [];
    });
    return recent.length ? [{ title: 'Usados há pouco', data: recent }, { title: 'Todos', data: rows }] : [{ title: null, data: rows }];
  }, [all, marks, now, query, equipment]);

  const close = () => {
    setQuery('');
    setPicked([]);
    onDismiss();
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={close} style={styles.dialog}>
        <Dialog.Title>{creating ? 'Novo exercício' : 'Adicionar exercícios'}</Dialog.Title>
        {creating ? (
          <NewExerciseForm
            initialName={query}
            onCancel={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false);
              setQuery('');
              setPicked((p) => [...p, id]);
            }}
          />
        ) : (
          <>
            <Dialog.Content>
              <Searchbar placeholder="Buscar" value={query} onChangeText={setQuery} autoFocus={false} />
              <EquipmentFilter exercises={all} value={equipment} onChange={setEquipment} />
            </Dialog.Content>
            <Dialog.ScrollArea style={styles.scroll}>
              <SectionList
                sections={sections}
                keyExtractor={(row) => row.key}
                keyboardShouldPersistTaps="handled"
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section }) => (section.title ? <List.Subheader>{section.title}</List.Subheader> : null)}
                renderItem={({ item: { exercise } }) => {
                  const selected = picked.includes(exercise.id);
                  return (
                    <List.Item
                      title={exercise.name}
                      description={`${exercise.category} · ${equipmentText(exercise)}`}
                      left={(p) => <ExerciseThumb exerciseId={exercise.id} equipment={exercise.equipment[0]} style={p.style} />}
                      right={() => <Checkbox status={selected ? 'checked' : 'unchecked'} onPress={() => toggle(exercise.id)} />}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggle(exercise.id)}
                    />
                  );
                }}
                ListEmptyComponent={<Text style={styles.empty}>Nenhum exercício encontrado</Text>}
              />
            </Dialog.ScrollArea>
            <Dialog.Actions>
              <Button onPress={() => setCreating(true)}>Criar novo</Button>
              <View style={styles.spacer} />
              <Button onPress={close}>Fechar</Button>
              <Button
                mode="contained"
                disabled={picked.length === 0}
                onPress={() => {
                  onPick(picked);
                  close();
                }}>
                {picked.length ? `Adicionar ${picked.length}` : 'Adicionar'}
              </Button>
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

const styles = StyleSheet.create({
  dialog: { maxHeight: '85%' },
  scroll: { paddingHorizontal: 0, maxHeight: 420 },
  empty: { padding: 24, textAlign: 'center' },
  spacer: { flex: 1 },
  form: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  // A horizontal ScrollView next to a flex list gets squeezed to nothing unless it can't shrink.
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filter: { gap: 6, paddingTop: 8, alignItems: 'center' },
  filterLabel: { width: 52, opacity: 0.7, letterSpacing: 0.6 },
});

