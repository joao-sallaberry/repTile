import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Dialog, IconButton, List, Portal, Text, useTheme } from 'react-native-paper';

import { BarChart } from '@/components/bar-chart';
import { ExerciseMedia, hasExerciseMedia } from '@/components/exercise-media';
import { MachineThumb } from '@/components/machine-thumb';
import { EquipmentChips, MEASURE_LABEL } from '@/components/exercise-picker';
import { FilterChip } from '@/components/filter-chips';
import { db } from '@/db/client';
import { exercises, machineExercises, machines, sessionSets, type Equipment } from '@/db/schema';
import { mediaEquipment } from '@/features/exercises/media-map';
import { useMachineMap } from '@/features/places/queries';
import { performedSets, type PerformedSetRow } from '@/features/session/repo';
import { countsTowardStats } from '@/features/session/sets';
import { describeSet } from '@/features/session/summary';
import { isFresh } from '@/features/stats/exercise-list';
import { computePRs, estimateOneRepMax } from '@/features/stats/prs';
import { defaultEquipment, equipmentLabel, equipmentText, hasStation, stationNoun } from '@/features/workouts/equipment';
import { deleteExercise, updateExercise } from '@/features/workouts/repo';
import { formatDate, formatWeight } from '@/lib/format';

/** Sets with the same equipment and machine are compared with each other. */
const variantKey = (s: Pick<PerformedSetRow, 'equipment' | 'machineId'>) => `${s.equipment ?? ''}:${s.machineId ?? ''}`;

/** "Máquinas", "Polias" or "Máquinas e polias", after the stations the exercise can use. */
function stationsTitle(equipment: Equipment[]) {
  const machine = equipment.includes('machine') || !equipment.includes('cable');
  return machine && equipment.includes('cable') ? 'Máquinas e polias' : machine ? 'Máquinas' : 'Polias';
}

/** What the "Evolução" chart plots for each session. */
const METRICS = [
  { key: 'weight', label: 'Carga', subtitle: 'Carga da melhor série por treino' },
  { key: 'orm', label: '1RM estimado', subtitle: '1RM estimado da melhor série por treino' },
  { key: 'volume', label: 'Volume', subtitle: 'Volume do exercício por treino' },
] as const;
type Metric = (typeof METRICS)[number]['key'];

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: exercise } = useLiveQuery(db.query.exercises.findFirst({ where: eq(exercises.id, id) }), [id]);
  // Reload whenever any set changes.
  const { updatedAt } = useLiveQuery(db.select({ id: sessionSets.id }).from(sessionSets).where(eq(sessionSets.exerciseId, id)), [id]);
  const [allSets, setAllSets] = useState<PerformedSetRow[]>([]);
  // History filter by variant (equipment + machine, see `variantKey`); undefined = all.
  const [variantFilter, setVariantFilter] = useState<string | undefined>(undefined);
  const machineMap = useMachineMap();
  // Machines this exercise is done on (their screen has the photo).
  const { data: linkedMachines } = useLiveQuery(
    db
      .select({ machine: machines })
      .from(machineExercises)
      .innerJoin(machines, eq(machines.id, machineExercises.machineId))
      .where(and(eq(machineExercises.exerciseId, id), isNull(machineExercises.deletedAt), isNull(machines.deletedAt)))
      .orderBy(asc(machines.name)),
    [id],
  );
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);
  // Which equipment's illustration is shown; follows the history filter.
  const [shownEquipment, setShownEquipment] = useState<Equipment | null>(null);
  const [metric, setMetric] = useState<Metric>('weight');
  const [now] = useState(() => Date.now());

  useEffect(() => {
    performedSets(id).then((rows) => setAllSets(rows.filter((r) => countsTowardStats(r.type))));
  }, [id, updatedAt]);

  // Each equipment + machine the exercise was done with, in order of first use.
  const variants = useMemo(() => {
    const map = new Map<string, PerformedSetRow>();
    for (const s of allSets) if (!map.has(variantKey(s))) map.set(variantKey(s), s);
    return [...map.entries()];
  }, [allSets]);
  const sets: PerformedSetRow[] = useMemo(
    () => (variantFilter === undefined ? allSets : allSets.filter((s) => variantKey(s) === variantFilter)),
    [allSets, variantFilter],
  );

  const prs = useMemo(() => computePRs(sets), [sets]);

  // Each session's sets, with the best one (highest estimated 1RM), oldest session first.
  const perSession = useMemo(() => {
    const map = new Map<string, { at: number; best: PerformedSetRow; orm: number; volume: number; sets: PerformedSetRow[] }>();
    for (const s of sets) {
      const orm = estimateOneRepMax(s.weight ?? 0, s.reps ?? 0);
      const cur = map.get(s.sessionId);
      const volume = (cur?.volume ?? 0) + (s.weight ?? 0) * (s.reps ?? 0);
      const list = [...(cur?.sets ?? []), s];
      map.set(s.sessionId, !cur || orm > cur.orm ? { at: s.completedAt, best: s, orm, volume, sets: list } : { ...cur, volume, sets: list });
    }
    return [...map.values()].sort((a, b) => a.at - b.at);
  }, [sets]);

  if (!exercise) return null;
  const illustrated = exercise.equipment.filter((e) => mediaEquipment(exercise.id).includes(e));
  const chart = perSession.slice(-10);
  const maxWeight = Math.max(...chart.map((c) => c.best.weight ?? 0), 0);
  const metricOf = (c: (typeof chart)[number]) =>
    metric === 'weight' ? (c.best.weight ?? 0) : metric === 'orm' ? Math.round(c.orm * 2) / 2 : Math.round(c.volume);
  const maxMetric = Math.max(...chart.map(metricOf), 0);
  // A record of the last days is marked as new, once there is an earlier session to beat.
  const fresh = (at: number | undefined) => perSession.length > 1 && at != null && isFresh(at, now);

  const confirmDelete = () =>
    Alert.alert('Excluir exercício?', 'Ele deixará de aparecer na lista. O histórico é mantido.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteExercise(exercise.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: exercise.name,
          headerRight: exercise.isCustom ? () => <IconButton icon="delete-outline" onPress={confirmDelete} /> : undefined,
        }}
      />
      {hasExerciseMedia(exercise.id) && (
        <View style={styles.media}>
          <ExerciseMedia exerciseId={exercise.id} equipment={shownEquipment ?? defaultEquipment(exercise)} size={240} animate />
          {illustrated.length > 1 && (
            <View style={styles.chips}>
              {illustrated.map((e) => (
                <FilterChip
                  key={e}
                  compact
                  selected={(shownEquipment ?? defaultEquipment(exercise)) === e}
                  onPress={() => setShownEquipment(e)}>
                  {equipmentLabel(e)}
                </FilterChip>
              ))}
            </View>
          )}
        </View>
      )}
      <Text variant="bodyMedium">
        {exercise.category} · {MEASURE_LABEL[exercise.measure]}
      </Text>
      <View style={styles.chips}>
        <Chip icon="pencil-outline" onPress={() => setEquipment(exercise.equipment)} accessibilityLabel="Alterar equipamento">
          {equipmentText(exercise)}
        </Chip>
      </View>
      <Portal>
        <Dialog visible={equipment != null} onDismiss={() => setEquipment(null)}>
          <Dialog.Title>Equipamento</Dialog.Title>
          <Dialog.Content>
            <EquipmentChips value={equipment ?? exercise.equipment} onChange={setEquipment} />
            {equipment && equipment.length > 1 && (
              <Text variant="bodySmall" style={styles.hint}>
                No treino você escolhe qual usar; o “Anterior” e os PRs ficam separados por equipamento.
              </Text>
            )}
            {equipment?.some(hasStation) && (
              <Text variant="bodySmall" style={styles.hint}>
                Na {stationNoun(equipment.find(hasStation))}, você também escolhe qual é a específica, e o histórico fica separado por ela.
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEquipment(null)}>Cancelar</Button>
            <Button
              mode="contained"
              onPress={async () => {
                if (equipment) await updateExercise(exercise.id, { equipment });
                setEquipment(null);
              }}>
              Salvar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {variants.length > 1 || (variants.length === 1 && variants[0][1].machineId != null) ? (
        <View style={styles.chips}>
          <FilterChip selected={variantFilter === undefined} onPress={() => setVariantFilter(undefined)}>
            Todos
          </FilterChip>
          {variants.map(([key, { equipment: used, machineId }]) => (
            <FilterChip
              key={key}
              icon={machineId ? 'cog-outline' : undefined}
              selected={variantFilter === key}
              onPress={() => {
                setVariantFilter(key);
                if (used) setShownEquipment(used);
              }}>
              {machineId
                ? (machineMap.get(machineId)?.name ?? 'Máquina')
                : used && hasStation(used)
                  ? `${equipmentLabel(used)} · sem ${stationNoun(used)}`
                  : equipmentLabel(used ?? 'none')}
            </FilterChip>
          ))}
        </View>
      ) : null}

      <View style={styles.grid}>
        <Stat label="Maior carga" value={prs.maxWeight ? `${formatWeight(prs.maxWeight.value)} × ${prs.maxWeight.reps}` : '—'} at={prs.maxWeight?.at} fresh={fresh(prs.maxWeight?.at)} />
        <Stat label="1RM estimado" value={prs.bestOneRepMax ? formatWeight(Math.round(prs.bestOneRepMax.value * 2) / 2) : '—'} at={prs.bestOneRepMax?.at} fresh={fresh(prs.bestOneRepMax?.at)} />
        <Stat label="Máx. reps" value={prs.maxReps ? String(prs.maxReps.value) : '—'} at={prs.maxReps?.at} fresh={fresh(prs.maxReps?.at)} />
        <Stat label="Maior volume" value={prs.bestSessionVolume ? formatWeight(prs.bestSessionVolume.value) : '—'} at={prs.bestSessionVolume?.at} fresh={fresh(prs.bestSessionVolume?.at)} />
      </View>

      {chart.length > 1 && maxWeight > 0 && (
        <Card mode="contained">
          <Card.Title title="Evolução" subtitle={METRICS.find((m) => m.key === metric)?.subtitle} />
          <Card.Content style={styles.chart}>
            <View style={styles.chips}>
              {METRICS.map((m) => (
                <FilterChip key={m.key} compact selected={metric === m.key} onPress={() => setMetric(m.key)}>
                  {m.label}
                </FilterChip>
              ))}
            </View>
            <BarChart
              data={chart.map((c) => ({
                label: shortDate.format(new Date(c.at)),
                value: metricOf(c),
                highlight: metricOf(c) === maxMetric,
              }))}
              format={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','))}
            />
          </Card.Content>
        </Card>
      )}

      {(exercise.equipment.some(hasStation) || linkedMachines.length > 0) && (
        <Card mode="outlined">
          <Card.Title title={stationsTitle(exercise.equipment)} subtitle={linkedMachines.length ? 'Toque para ver a foto, os locais e o histórico' : undefined} />
          {linkedMachines.length ? (
            linkedMachines.map(({ machine }) => (
              <List.Item
                key={machine.id}
                title={machine.name}
                description={machine.photo ? undefined : 'Sem foto · toque para adicionar'}
                left={(p) => <MachineThumb photo={machine.photo} style={p.style} />}
                right={(p) => <List.Icon {...p} icon="chevron-right" />}
                onPress={() => router.push({ pathname: '/machines/[id]', params: { id: machine.id } })}
              />
            ))
          ) : (
            <Card.Content>
              <Text variant="bodyMedium" style={styles.hint}>
                Escolha a {stationNoun(exercise.equipment.find(hasStation))} durante o treino (no nome do exercício) e ela aparece aqui.
              </Text>
            </Card.Content>
          )}
        </Card>
      )}

      {perSession.length > 0 ? (
        <Card mode="outlined">
          <Card.Title title="Últimos treinos" />
          {[...perSession].reverse().slice(0, 15).map((c) => (
            <List.Item
              key={c.best.sessionId}
              title={`${formatDate(c.at)} · ${c.best.sessionName}`}
              description={[...c.sets].sort((a, b) => a.setIndex - b.setIndex).map(describeSet).join(' · ')}
              descriptionNumberOfLines={2}
              right={() => (c.sets.some((x) => x.isPr) ? <PrBadge /> : null)}
              onPress={() => router.push({ pathname: '/history/[id]', params: { id: c.best.sessionId } })}
            />
          ))}
        </Card>
      ) : (
        <Text variant="bodyMedium" style={styles.empty}>
          Ainda não há séries registradas deste exercício.
        </Text>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, at, fresh }: { label: string; value: string; at?: number; fresh?: boolean }) {
  const theme = useTheme();
  return (
    <Card mode="contained" style={styles.stat}>
      <Card.Content>
        <Text variant="labelMedium">{label}</Text>
        <Text variant="titleLarge">{value}</Text>
        {at != null && (
          <Text variant="labelSmall" style={fresh ? { color: theme.colors.tertiary, fontWeight: '700' } : undefined}>
            {fresh ? `novo · ${formatDate(at)}` : formatDate(at)}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

function PrBadge() {
  const theme = useTheme();
  return (
    <Text
      variant="labelSmall"
      style={[styles.badge, { backgroundColor: theme.colors.tertiaryContainer, color: theme.colors.onTertiaryContainer }]}>
      PR
    </Text>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  media: { alignItems: 'center', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexBasis: '48%', flexGrow: 1 },
  empty: { textAlign: 'center', padding: 24, opacity: 0.7 },
  hint: { marginTop: 12, opacity: 0.7 },
  chart: { gap: 12 },
  badge: { alignSelf: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
});
