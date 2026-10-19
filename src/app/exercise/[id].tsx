import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Dialog, IconButton, List, Portal, Text } from 'react-native-paper';

import { BarChart } from '@/components/bar-chart';
import { ExerciseMedia, hasExerciseMedia } from '@/components/exercise-media';
import { MachineThumb } from '@/components/machine-thumb';
import { EquipmentChips, MEASURE_LABEL } from '@/components/exercise-picker';
import { db } from '@/db/client';
import { exercises, machineExercises, machines, sessionSets, type Equipment } from '@/db/schema';
import { mediaEquipment } from '@/features/exercises/media-map';
import { useMachineMap } from '@/features/places/queries';
import { performedSets, type PerformedSetRow } from '@/features/session/repo';
import { countsTowardStats } from '@/features/session/sets';
import { computePRs, estimateOneRepMax, type PerformedSet } from '@/features/stats/prs';
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

  useEffect(() => {
    performedSets(id).then((rows) => setAllSets(rows.filter((r) => countsTowardStats(r.type))));
  }, [id, updatedAt]);

  // Each equipment + machine the exercise was done with, in order of first use.
  const variants = useMemo(() => {
    const map = new Map<string, PerformedSetRow>();
    for (const s of allSets) if (!map.has(variantKey(s))) map.set(variantKey(s), s);
    return [...map.entries()];
  }, [allSets]);
  const sets: PerformedSet[] = useMemo(
    () => (variantFilter === undefined ? allSets : allSets.filter((s) => variantKey(s) === variantFilter)),
    [allSets, variantFilter],
  );

  const prs = useMemo(() => computePRs(sets), [sets]);

  // Best set (highest estimated 1RM) of each session.
  const perSession = useMemo(() => {
    const map = new Map<string, { at: number; best: PerformedSet; orm: number }>();
    for (const s of sets) {
      const orm = estimateOneRepMax(s.weight ?? 0, s.reps ?? 0);
      const cur = map.get(s.sessionId);
      if (!cur || orm > cur.orm) map.set(s.sessionId, { at: s.completedAt, best: s, orm });
    }
    return [...map.values()].sort((a, b) => a.at - b.at);
  }, [sets]);

  if (!exercise) return null;
  const illustrated = exercise.equipment.filter((e) => mediaEquipment(exercise.id).includes(e));
  const chart = perSession.slice(-10);
  const maxWeight = Math.max(...chart.map((c) => c.best.weight ?? 0), 0);

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
                <Chip
                  key={e}
                  compact
                  selected={(shownEquipment ?? defaultEquipment(exercise)) === e}
                  showSelectedOverlay
                  onPress={() => setShownEquipment(e)}>
                  {equipmentLabel(e)}
                </Chip>
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
          <Chip selected={variantFilter === undefined} onPress={() => setVariantFilter(undefined)}>
            Todos
          </Chip>
          {variants.map(([key, { equipment: used, machineId }]) => (
            <Chip key={key} icon={machineId ? 'cog-outline' : undefined} selected={variantFilter === key} onPress={() => {
                setVariantFilter(key);
                if (used) setShownEquipment(used);
              }}>
              {machineId
                ? (machineMap.get(machineId)?.name ?? 'Máquina')
                : used && hasStation(used)
                  ? `${equipmentLabel(used)} · sem ${stationNoun(used)}`
                  : equipmentLabel(used ?? 'none')}
            </Chip>
          ))}
        </View>
      ) : null}

      <View style={styles.grid}>
        <Stat label="Maior carga" value={prs.maxWeight ? `${formatWeight(prs.maxWeight.value)} × ${prs.maxWeight.reps}` : '—'} sub={prs.maxWeight && formatDate(prs.maxWeight.at)} />
        <Stat label="1RM estimado" value={prs.bestOneRepMax ? formatWeight(Math.round(prs.bestOneRepMax.value * 2) / 2) : '—'} sub={prs.bestOneRepMax && formatDate(prs.bestOneRepMax.at)} />
        <Stat label="Máx. reps" value={prs.maxReps ? String(prs.maxReps.value) : '—'} sub={prs.maxReps && formatDate(prs.maxReps.at)} />
        <Stat label="Maior volume" value={prs.bestSessionVolume ? formatWeight(prs.bestSessionVolume.value) : '—'} sub={prs.bestSessionVolume && formatDate(prs.bestSessionVolume.at)} />
      </View>

      {chart.length > 1 && maxWeight > 0 && (
        <Card mode="contained">
          <Card.Title title="Evolução" subtitle="Carga da melhor série por treino" />
          <Card.Content>
            <BarChart
              data={chart.map((c) => ({
                label: shortDate.format(new Date(c.at)),
                value: c.best.weight ?? 0,
                highlight: (c.best.weight ?? 0) === maxWeight,
              }))}
              format={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
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
              title={formatDate(c.at)}
              description={c.best.weight ? `${formatWeight(c.best.weight)} × ${c.best.reps}` : `${c.best.reps} reps`}
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <Card mode="contained" style={styles.stat}>
      <Card.Content>
        <Text variant="labelMedium">{label}</Text>
        <Text variant="titleLarge">{value}</Text>
        {sub ? <Text variant="labelSmall">{sub}</Text> : null}
      </Card.Content>
    </Card>
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
});
