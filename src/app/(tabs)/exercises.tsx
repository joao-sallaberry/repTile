import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Appbar, Dialog, List, Portal, Searchbar, Text, useTheme } from 'react-native-paper';

import { ExerciseThumb } from '@/components/exercise-media';
import { CategoryFilter, EquipmentFilter, matchesExercise, MEASURE_LABEL, NewExerciseForm } from '@/components/exercise-picker';
import { PrimaryFab } from '@/components/primary-fab';
import type { Equipment, Exercise } from '@/db/schema';
import { plural } from '@/features/history/session-card';
import { relativeDays } from '@/features/home/stats';
import { recentExerciseIds, recordsThisMonth, type ExerciseMark } from '@/features/stats/exercise-list';
import { useExerciseMarks } from '@/features/stats/queries';
import { equipmentText } from '@/features/workouts/equipment';
import { useExercises } from '@/features/workouts/queries';

/** `recent`: a row of "Feitos há pouco", which says when the exercise was last done. */
type Row = { key: string; exercise: Exercise; recent?: boolean };

export default function ExercisesScreen() {
  const all = useExercises();
  const [now] = useState(() => Date.now());
  const marks = useExerciseMarks(now);
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const sections = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const e of all) {
      if (!matchesExercise(e, query, equipment, categories)) continue;
      groups.set(e.category, [...(groups.get(e.category) ?? []), { key: e.id, exercise: e }]);
    }
    const list = [...groups.entries()].map(([title, data]) => ({ title, note: plural(data.length, 'exercício', 'exercícios'), data }));
    // The exercises of the last week come first, while nothing is being searched or filtered.
    if (query.trim() || equipment.length || categories.length) return list;
    const byId = new Map(all.map((e) => [e.id, e]));
    const recent = recentExerciseIds(marks, now).flatMap((id) => {
      const exercise = byId.get(id);
      return exercise ? [{ key: `recent:${id}`, exercise, recent: true }] : [];
    });
    return recent.length ? [{ title: 'Feitos há pouco', note: 'últimos 7 dias', data: recent }, ...list] : list;
  }, [all, marks, now, query, equipment, categories]);

  const records = recordsThisMonth(marks, now);

  return (
    <View style={styles.flex}>
      <Appbar.Header>
        <Appbar.Content title="Exercícios" />
      </Appbar.Header>
      {/* Paper's MD3 Appbar ignores `subtitle`, so the counts go below the header (as in Treinos). */}
      <Text variant="bodyMedium" style={[styles.muted, styles.count]}>
        {[plural(all.length, 'exercício', 'exercícios'), records ? `${plural(records, 'recorde', 'recordes')} este mês` : null]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <Searchbar placeholder="Buscar exercício" value={query} onChangeText={setQuery} style={styles.search} />
      <CategoryFilter exercises={all} value={categories} onChange={setCategories} label="GRUPO" style={styles.filter} />
      <EquipmentFilter exercises={all} value={equipment} onChange={setEquipment} label="EQUIP." style={styles.filter} />
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum exercício encontrado</Text>}
        renderSectionHeader={({ section }) => (
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.flex}>
              {section.title}
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              {section.note}
            </Text>
          </View>
        )}
        renderItem={({ item: { exercise, recent } }) => (
          <List.Item
            title={exercise.name}
            description={`${equipmentText(exercise)} · ${MEASURE_LABEL[exercise.measure]}`}
            descriptionNumberOfLines={1}
            left={(p) => <ExerciseThumb exerciseId={exercise.id} equipment={exercise.equipment[0]} style={p.style} />}
            right={() => <Mark mark={marks.get(exercise.id)} now={now} recent={recent} />}
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
          />
        )}
      />
      <PrimaryFab icon="plus" label="Novo exercício" onPress={() => setCreating(true)} />
      <Portal>
        <Dialog visible={creating} onDismiss={() => setCreating(false)}>
          <Dialog.Title>Novo exercício</Dialog.Title>
          <NewExerciseForm initialName={query} onCancel={() => setCreating(false)} onCreated={() => setCreating(false)} />
        </Dialog>
      </Portal>
    </View>
  );
}

/**
 * The exercise's best set and when it was done; a recent record gets the green "PR" badge. In "Feitos há pouco"
 * (`recent`) a best set that isn't a new record shows when the exercise was last done instead.
 */
function Mark({ mark, now, recent }: { mark: ExerciseMark | undefined; now: number; recent?: boolean }) {
  const theme = useTheme();
  if (!mark) {
    return (
      <Text variant="bodySmall" style={[styles.mark, styles.muted]}>
        sem registro
      </Text>
    );
  }
  const when = relativeDays(mark.at, now);
  return (
    <View style={styles.mark}>
      <Text variant="titleSmall" style={styles.number}>
        {mark.text}
      </Text>
      {mark.fresh ? (
        <Text
          variant="labelSmall"
          style={[styles.badge, { backgroundColor: theme.colors.tertiaryContainer, color: theme.colors.onTertiaryContainer }]}>
          PR {when}
        </Text>
      ) : (
        <Text variant="bodySmall" style={styles.muted}>
          {recent ? `feito ${relativeDays(mark.lastAt, now)}` : when}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { marginHorizontal: 16, marginBottom: 4 },
  filter: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  muted: { opacity: 0.7 },
  count: { marginHorizontal: 16, marginBottom: 8 },
  empty: { padding: 24, textAlign: 'center', opacity: 0.7 },
  list: { paddingBottom: 96 },
  mark: { alignSelf: 'center', alignItems: 'flex-end', gap: 3, marginLeft: 8 },
  number: { fontVariant: ['tabular-nums'] },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9, overflow: 'hidden' },
});
