import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Card, Icon, IconButton, Searchbar, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { freezeWhenBlurred } from '@/components/freeze-when-blurred';
import { FilterChips } from '@/components/filter-chips';
import { PrimaryFab } from '@/components/primary-fab';
import { useRoutines, type RoutineRow } from '@/features/home/queries';
import { relativeDays } from '@/features/home/stats';
import { useLocations } from '@/features/places/queries';
import { beginRoutine } from '@/features/session/begin';
import { describeShape, isWod, workoutIcon } from '@/features/workouts/blocks';
import { WORKOUT_TEMPLATES } from '@/features/workouts/templates';
import { useInstallTemplate } from '@/features/workouts/use-install-template';
import { normalizeSearch } from '@/lib/search';
import { STRENGTH_TINT } from '@/theme';

type Filter = { kind: 'all' } | { kind: 'strength' } | { kind: 'wod' } | { kind: 'location'; id: string };


const hasStrength = (r: RoutineRow) => !r.blocks.length || r.blocks.some((b) => b.kind === 'exercises');
const hasWod = (r: RoutineRow) => r.blocks.some((b) => isWod(b.kind));

function matches(r: RoutineRow, filter: Filter, query: string) {
  if (filter.kind === 'strength' && !hasStrength(r)) return false;
  if (filter.kind === 'wod' && !hasWod(r)) return false;
  if (filter.kind === 'location' && !r.locationIds.includes(filter.id)) return false;
  const q = normalizeSearch(query);
  return !q || normalizeSearch(`${r.name} ${r.exerciseNames.join(' ')}`).includes(q);
}

function WorkoutsScreen() {
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const routines = useRoutines();
  const locations = useLocations();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });

  const ordered = useMemo(() => [...routines].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [routines]);
  const shown = ordered.filter((r) => matches(r, filter, query));

  const routineLocations = locations.filter((l) => routines.some((r) => r.locationIds.includes(l.id)));
  const chips: { key: string; label: string; filter: Filter }[] = [
    { key: 'all', label: 'Todos', filter: { kind: 'all' } },
    ...(routines.some(hasStrength) && routines.some(hasWod)
      ? [
          { key: 'strength', label: 'Musculação', filter: { kind: 'strength' } as Filter },
          { key: 'wod', label: 'WOD', filter: { kind: 'wod' } as Filter },
        ]
      : []),
    ...routineLocations.map((l) => ({ key: l.id, label: l.name, filter: { kind: 'location', id: l.id } as Filter })),
  ];
  const chipKey = filter.kind === 'location' ? filter.id : filter.kind;

  const count = routines.length;

  return (
    <View style={styles.flex}>
      <Appbar.Header>
        <Appbar.Content title="Treinos" titleStyle={styles.appTitle} />
      </Appbar.Header>
      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          count ? (
            <View style={styles.top}>
              <Text variant="bodyMedium" style={styles.muted}>
                {count === 1 ? '1 rotina' : `${count} rotinas`}
              </Text>
              {count > 3 && <Searchbar placeholder="Buscar rotina" value={query} onChangeText={setQuery} />}
              <FilterChips
                options={chips}
                value={chipKey}
                onChange={(key) => setFilter(chips.find((c) => c.key === key)!.filter)}
              />
              <Text variant="titleMedium" style={styles.sectionHeader}>
                Minhas rotinas
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <RoutineCard
            routine={item}
            now={now}
            location={
              item.locationIds
                .map((id) => locations.find((l) => l.id === id)?.name)
                .filter(Boolean)
                .join(' · ') || undefined
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          count ? (
            <Text variant="bodyMedium" style={[styles.muted, styles.center]}>
              Nenhuma rotina encontrada
            </Text>
          ) : (
            <View style={styles.empty}>
              <Text variant="titleMedium">Nenhum treino ainda</Text>
              <Text variant="bodyMedium" style={styles.center}>
                Toque em “Nova rotina” ou comece de um modelo.
              </Text>
            </View>
          )
        }
        ListFooterComponent={<Templates />}
      />
      <PrimaryFab icon="plus" label="Nova rotina" onPress={() => router.push('/workout/edit')} />
    </View>
  );
}

/** One routine: icon, shape, last time done, its exercises and location, with ▶ to start it. */
function RoutineCard({ routine: r, now, location }: { routine: RoutineRow; now: number; location?: string }) {
  const theme = useTheme();
  const plain = hasStrength(r);
  return (
    <Card mode="contained" onPress={() => router.push({ pathname: '/workout/[id]', params: { id: r.id } })}>
      <View style={styles.row}>
        <View
          style={[
            styles.icon,
            { backgroundColor: plain ? STRENGTH_TINT : theme.colors.secondaryContainer },
          ]}>
          <Icon
            source={workoutIcon(r.blocks.map((b) => b.kind))}
            size={22}
            color={plain ? theme.colors.primary : theme.colors.onSecondaryContainer}
          />
        </View>
        <View style={styles.text}>
          <Text variant="titleSmall">{r.name}</Text>
          <Text variant="bodySmall" style={styles.muted}>
            {describeShape(r.blocks)} · {relativeDays(r.lastDoneAt, now)}
          </Text>
          {r.exerciseNames.length > 0 && (
            <Text variant="bodySmall" style={styles.faint} numberOfLines={1}>
              {r.exerciseNames.join(', ')}
            </Text>
          )}
          {location && (
            <View style={styles.place}>
              <Icon source="map-marker-outline" size={14} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
                {location}
              </Text>
            </View>
          )}
        </View>
        <IconButton
          icon="play"
          mode="contained"
          containerColor={STRENGTH_TINT}
          iconColor={theme.colors.primary}
          size={22}
          accessibilityLabel={`Iniciar ${r.name}`}
          onPress={() => beginRoutine(r.id)}
        />
      </View>
    </Card>
  );
}

/** "Começar de um modelo": the ready-made templates also offered on first use. */
function Templates() {
  const theme = useTheme();
  const { installing, apply } = useInstallTemplate();
  return (
    <View style={styles.templates}>
      <View style={styles.templatesHeader}>
        <Text variant="titleMedium">Começar de um modelo</Text>
        <Text variant="bodySmall" style={styles.muted}>
          Vira uma rotina sua, que você pode editar
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
        {WORKOUT_TEMPLATES.map((t) => (
          <TouchableRipple
            key={t.key}
            borderless
            disabled={installing != null}
            onPress={() => apply(t)}
            accessibilityRole="button"
            accessibilityLabel={`Usar o modelo ${t.name}`}
            style={[styles.template, { borderColor: theme.colors.outlineVariant }]}>
            <View style={styles.templateText}>
              <Text variant="titleSmall">{t.name}</Text>
              <Text variant="bodySmall" style={styles.muted}>
                {installing === t.key ? 'Criando…' : t.subtitle}
              </Text>
            </View>
          </TouchableRipple>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  appTitle: { fontWeight: '700' },
  list: { padding: 12, paddingTop: 0, paddingBottom: 104 },
  top: { gap: 12, paddingBottom: 8, paddingHorizontal: 4 },
  sectionHeader: { marginTop: 8 },
  gap: { height: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 4 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3 },
  muted: { opacity: 0.7 },
  faint: { opacity: 0.5 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  center: { textAlign: 'center' },
  empty: { alignItems: 'center', padding: 32, gap: 8 },
  templates: { gap: 8, marginTop: 24 },
  templatesHeader: { gap: 2, paddingHorizontal: 4 },
  templateRow: { gap: 8 },
  template: { width: 148, minHeight: 88, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed' },
  templateText: { gap: 4, padding: 12 },
});

export default freezeWhenBlurred(WorkoutsScreen);
