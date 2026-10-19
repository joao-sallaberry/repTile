import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Card, FAB, Icon, IconButton, Searchbar, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { FilterChips } from '@/components/filter-chips';import { useRoutines, type RoutineRow } from '@/features/home/queries';
import { relativeDays, rotationOrder } from '@/features/home/stats';
import { useLocations } from '@/features/places/queries';
import { beginRoutine } from '@/features/session/begin';
import { describeShape, isWod, workoutIcon } from '@/features/workouts/blocks';
import { WORKOUT_TEMPLATES } from '@/features/workouts/templates';
import { useInstallTemplate } from '@/features/workouts/use-install-template';
import { normalizeSearch } from '@/lib/search';

type Filter = { kind: 'all' } | { kind: 'strength' } | { kind: 'wod' } | { kind: 'location'; id: string };

/** Dark orange behind the ▶ and the dumbbell icon (the design's `#2B1A0C`). */
const PLAY_TINT = '#2B1A0C';

const hasStrength = (r: RoutineRow) => !r.blocks.length || r.blocks.some((b) => b.kind === 'exercises');
const hasWod = (r: RoutineRow) => r.blocks.some((b) => isWod(b.kind));

function matches(r: RoutineRow, filter: Filter, query: string) {
  if (filter.kind === 'strength' && !hasStrength(r)) return false;
  if (filter.kind === 'wod' && !hasWod(r)) return false;
  if (filter.kind === 'location' && r.locationId !== filter.id) return false;
  const q = normalizeSearch(query);
  return !q || normalizeSearch(`${r.name} ${r.exerciseNames.join(' ')}`).includes(q);
}

export default function WorkoutsScreen() {
  const theme = useTheme();
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const routines = useRoutines();
  const locations = useLocations();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });

  // Rotation order (ADR 0008): the first one is what Home suggests next.
  const ordered = useMemo(
    () => rotationOrder(routines, new Map(routines.flatMap((r) => (r.lastDoneAt ? [[r.id, r.lastDoneAt] as const] : [])))),
    [routines],
  );
  const nextId = ordered[0]?.id;
  const shown = ordered.filter((r) => matches(r, filter, query));

  const routineLocations = locations.filter((l) => routines.some((r) => r.locationId === l.id));
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
              <View style={styles.sectionHeader}>
                <Text variant="titleMedium">Rotinas</Text>
                {count > 1 && (
                  <Text variant="bodySmall" style={styles.muted}>
                    a mais antiga primeiro
                  </Text>
                )}
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <RoutineCard
            routine={item}
            next={item.id === nextId && count > 1}
            now={now}
            location={item.locationId ? locations.find((l) => l.id === item.locationId)?.name : undefined}
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
      <FAB
        icon="plus"
        label="Nova rotina"
        color={theme.colors.onPrimary}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/workout/edit')} />
    </View>
  );
}

/** One routine: icon, shape, last time done, its exercises and location, with ▶ to start it. The next in the rotation stands out. */
function RoutineCard({ routine: r, next, now, location }: { routine: RoutineRow; next: boolean; now: number; location?: string }) {
  const theme = useTheme();
  const plain = hasStrength(r);
  return (
    <Card
      mode="contained"
      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: r.id } })}
      style={next ? { backgroundColor: '#23140A', borderColor: theme.colors.primaryContainer, borderWidth: 1 } : undefined}>
      <View style={styles.row}>
        <View
          style={[
            styles.icon,
            { backgroundColor: plain ? PLAY_TINT : theme.colors.secondaryContainer },
          ]}>
          <Icon
            source={workoutIcon(r.blocks.map((b) => b.kind))}
            size={22}
            color={plain ? theme.colors.primary : theme.colors.onSecondaryContainer}
          />
        </View>
        <View style={styles.text}>
          {next && (
            <Text
              variant="labelSmall"
              style={[styles.tag, { backgroundColor: theme.colors.primaryContainer, color: theme.colors.onPrimaryContainer }]}>
              PRÓXIMO
            </Text>
          )}
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
          containerColor={next ? theme.colors.primary : PLAY_TINT}
          iconColor={next ? theme.colors.onPrimary : theme.colors.primary}
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
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 },
  gap: { height: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 4 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden', letterSpacing: 0.6 },
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
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
