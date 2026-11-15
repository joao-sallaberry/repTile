import { useMemo, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { Modal, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  Icon,
  IconButton,
  SegmentedButtons,
  Searchbar,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseThumb } from '@/components/exercise-media';
import { FilterChip } from '@/components/filter-chips';
import { EQUIPMENT, MEASURES, type Equipment, type Exercise, type Measure } from '@/db/schema';
import { plural } from '@/features/history/session-card';
import { relativeDays } from '@/features/home/stats';
import { recentExerciseIds, type ExerciseMark } from '@/features/stats/exercise-list';
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
  /** Where they go, under the title ("à rotina Push"). */
  subtitle?: string;
};

type PickerRow = { key: string; exercise: Exercise };
type Panel = 'category' | 'equipment' | null;

/**
 * Full-screen exercise picker: search, muscle group and equipment filters (each a button that opens its chips),
 * the ones used in the last two weeks first, each with its best set and when it was last done. Several can be
 * ticked; each shows its number in the order they will be added, and the tray at the bottom lists them (✕ takes
 * one out) above "Adicionar N exercícios". "Novo" creates an exercise, which joins the selection.
 */
export function ExercisePicker({ visible, onDismiss, onPick, subtitle }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const all = useExercises();
  const [now] = useState(() => Date.now());
  const marks = useExerciseMarks(now);
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const byId = useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);

  const sections = useMemo((): { title: string | null; data: PickerRow[] }[] => {
    const rows: PickerRow[] = all
      .filter((e) => matchesExercise(e, query, equipment, categories))
      // `useExercises` orders by group, then name; here it's just A–Z.
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((e) => ({ key: e.id, exercise: e }));
    if (query.trim() || equipment.length || categories.length) return [{ title: null, data: rows }];
    const recent = recentExerciseIds(marks, now, 14).flatMap((id) => {
      const exercise = byId.get(id);
      return exercise ? [{ key: `recent:${id}`, exercise }] : [];
    });
    return recent.length
      ? [
          { title: 'Usados há pouco', data: recent },
          { title: 'Todos · A–Z', data: rows },
        ]
      : [{ title: null, data: rows }];
  }, [all, byId, marks, now, query, equipment, categories]);

  const close = () => {
    setQuery('');
    setPicked([]);
    setEquipment([]);
    setCategories([]);
    setPanel(null);
    setCreating(false);
    onDismiss();
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const filterLabel = (values: string[], none: string) => (values.length ? values.join(', ') : none);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => (creating ? setCreating(false) : close())} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.screen, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <IconButton icon="close" accessibilityLabel="Fechar" onPress={close} />
          <View style={styles.flex}>
            <Text variant="titleLarge" numberOfLines={1}>
              Adicionar exercícios
            </Text>
            {subtitle && (
              <Text variant="bodySmall" numberOfLines={1} style={styles.muted}>
                {subtitle}
              </Text>
            )}
          </View>
          <Button icon="plus" compact onPress={() => setCreating(true)}>
            Novo
          </Button>
        </View>

        <View style={styles.top}>
          <Searchbar placeholder="Buscar por nome ou músculo" value={query} onChangeText={setQuery} />
          <View style={styles.filterButtons}>
            <FilterButton
              label={filterLabel(categories, 'Grupo')}
              active={categories.length > 0}
              open={panel === 'category'}
              onPress={() => setPanel(panel === 'category' ? null : 'category')}
            />
            <FilterButton
              label={filterLabel(equipment.map(equipmentLabel), 'Equipamento')}
              active={equipment.length > 0}
              open={panel === 'equipment'}
              onPress={() => setPanel(panel === 'equipment' ? null : 'equipment')}
            />
          </View>
          {panel && (
            <View style={styles.chips}>
              {(panel === 'category'
                ? exerciseCategories(all).map((c) => ({ key: c, label: c }))
                : EQUIPMENT.filter((e) => all.some((x) => x.equipment.includes(e))).map((e) => ({ key: e, label: equipmentLabel(e) }))
              ).map((o) => {
                const values: string[] = panel === 'category' ? categories : equipment;
                const selected = values.includes(o.key);
                const next = selected ? values.filter((v) => v !== o.key) : [...values, o.key];
                return (
                  <FilterChip
                    key={o.key}
                    compact
                    selected={selected}
                    onPress={() => (panel === 'category' ? setCategories(next) : setEquipment(next as Equipment[]))}>
                    {o.label}
                  </FilterChip>
                );
              })}
            </View>
          )}
        </View>

        <SectionList
          style={styles.flex}
          contentContainerStyle={styles.list}
          sections={sections}
          keyExtractor={(row) => row.key}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <Text variant="labelMedium" style={[styles.sectionTitle, styles.muted]}>
                {section.title.toUpperCase()}
              </Text>
            ) : null
          }
          renderItem={({ item: { exercise } }) => (
            <PickerItem
              exercise={exercise}
              mark={marks.get(exercise.id)}
              now={now}
              order={picked.indexOf(exercise.id) + 1}
              onPress={() => toggle(exercise.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.muted}>Nenhum exercício encontrado</Text>
              <Button icon="plus" onPress={() => setCreating(true)}>
                {query.trim() ? `Criar “${query.trim()}”` : 'Criar exercício'}
              </Button>
            </View>
          }
        />

        <View
          style={[
            styles.tray,
            { backgroundColor: theme.colors.elevation.level2, borderColor: theme.colors.outlineVariant, paddingBottom: 12 + insets.bottom },
          ]}>
          {picked.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayChips} accessibilityLabel="Selecionados, na ordem em que entram">
              {picked.map((id, i) => {
                const name = byId.get(id)?.name ?? 'Exercício';
                return (
                  <View key={id} style={[styles.trayChip, { backgroundColor: theme.colors.elevation.level4 }]}>
                    <OrderBadge n={i + 1} size={22} />
                    <Text variant="labelLarge">{name}</Text>
                    <IconButton icon="close" size={14} style={styles.trayRemove} accessibilityLabel={`Tirar ${name} da seleção`} onPress={() => toggle(id)} />
                  </View>
                );
              })}
            </ScrollView>
          )}
          <Button
            mode="contained"
            disabled={picked.length === 0}
            contentStyle={styles.addContent}
            labelStyle={styles.addLabel}
            onPress={() => {
              onPick(picked);
              close();
            }}>
            {picked.length ? `Adicionar ${plural(picked.length, 'exercício', 'exercícios')}` : 'Escolha os exercícios'}
          </Button>
        </View>

        {/* Inside the Modal, without Portal: a Portal would render under it. */}
        <Dialog visible={creating} onDismiss={() => setCreating(false)}>
          <Dialog.Title>Novo exercício</Dialog.Title>
          <NewExerciseForm
            initialName={query}
            onCancel={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false);
              setQuery('');
              setPicked((p) => [...p, id]);
            }}
          />
        </Dialog>
      </View>
    </Modal>
  );
}

/** "Grupo" / "Equipamento": shows what is picked and opens its chips below. */
function FilterButton({ label, active, open, onPress }: { label: string; active: boolean; open: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableRipple
      borderless
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={[
        styles.filterButton,
        active
          ? { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary }
          : { borderColor: theme.colors.outline },
      ]}>
      <View style={styles.filterButtonInner}>
        <Text variant="labelLarge" numberOfLines={1} style={[styles.shrink, active && { color: theme.colors.onPrimaryContainer }]}>
          {label}
        </Text>
        <Icon source={open ? 'chevron-up' : 'chevron-down'} size={18} color={active ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant} />
      </View>
    </TouchableRipple>
  );
}

/** The number an exercise gets in the selection (the order it will be added), or an empty ring. */
function OrderBadge({ n, size }: { n: number; size: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
        n ? { backgroundColor: theme.colors.primary } : { borderWidth: 2, borderColor: theme.colors.outline },
      ]}>
      {n > 0 && (
        <Text variant="labelMedium" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>
          {n}
        </Text>
      )}
    </View>
  );
}

function PickerItem({
  exercise,
  mark,
  now,
  order,
  onPress,
}: {
  exercise: Exercise;
  mark: ExerciseMark | undefined;
  now: number;
  /** Position in the selection (1-based), 0 when not picked. */
  order: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <TouchableRipple
      borderless
      accessibilityRole="checkbox"
      accessibilityState={{ checked: order > 0 }}
      accessibilityLabel={`${exercise.name}${order ? `, ${order}º da seleção` : ''}`}
      onPress={onPress}
      style={[styles.item, order > 0 && { backgroundColor: theme.colors.primaryContainer }]}>
      <View style={styles.itemInner}>
        <ExerciseThumb exerciseId={exercise.id} equipment={exercise.equipment[0]} size={48} />
        <View style={styles.flex}>
          <Text variant="titleMedium" numberOfLines={1}>
            {exercise.name}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={styles.muted}>
            {`${exercise.category} · ${equipmentText(exercise)}`}
          </Text>
        </View>
        <View style={styles.mark}>
          <Text variant="labelLarge" style={styles.number}>
            {mark?.text ?? '—'}
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            {relativeDays(mark?.lastAt, now)}
          </Text>
        </View>
        <OrderBadge n={order} size={28} />
      </View>
    </TouchableRipple>
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
  screen: { flex: 1 },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  muted: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 },
  top: { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },
  filterButtons: { flexDirection: 'row', gap: 8 },
  filterButton: { borderWidth: 1, borderRadius: 18, maxWidth: '60%' },
  filterButtonInner: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingLeft: 14, paddingRight: 8 },
  list: { paddingHorizontal: 8, paddingBottom: 16 },
  sectionTitle: { marginTop: 12, marginBottom: 4, marginHorizontal: 8, letterSpacing: 0.6 },
  item: { borderRadius: 14 },
  itemInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, minHeight: 64 },
  mark: { alignItems: 'flex-end', gap: 2 },
  number: { fontVariant: ['tabular-nums'] },
  empty: { padding: 24, alignItems: 'center', gap: 8 },
  tray: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  trayChips: { gap: 8 },
  trayChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, paddingLeft: 6 },
  trayRemove: { margin: 0 },
  addContent: { height: 50 },
  addLabel: { fontSize: 16 },
  form: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  // A horizontal ScrollView next to a flex list gets squeezed to nothing unless it can't shrink.
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filter: { gap: 6, paddingTop: 8, alignItems: 'center' },
  filterLabel: { width: 52, opacity: 0.7, letterSpacing: 0.6 },
});

