import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Icon, IconButton, Menu, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { ExerciseThumb } from '@/components/exercise-media';
import { db } from '@/db/client';
import { sessionBlocks, sessions, workoutBlocks, workoutItems, workoutItemSets, workouts, type SessionBlock } from '@/db/schema';
import { durationSec, plural, SessionCard } from '@/features/history/session-card';
import { useRoutineSessions } from '@/features/home/queries';
import { formatMinutes, relativeDays } from '@/features/home/stats';
import { useLocation, useMachineMap } from '@/features/places/queries';
import { beginRoutine } from '@/features/session/begin';
import { compareWodResults } from '@/features/stats/prs';
import { BLOCK_KIND_ICON, describeBlockFormat, isWod, workoutIcon } from '@/features/workouts/blocks';
import { describeItem, describeResult, describeTargets } from '@/features/workouts/describe';
import { equipmentLabel } from '@/features/workouts/equipment';
import { useExerciseMap } from '@/features/workouts/queries';
import { deleteWorkout, duplicateWorkout } from '@/features/workouts/repo';
import { formatDate } from '@/lib/format';
import { STRENGTH_TINT } from '@/theme';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const exerciseMap = useExerciseMap();
  const theme = useTheme();

  const { data: workout } = useLiveQuery(
    db.query.workouts.findFirst({
      where: and(eq(workouts.id, id), isNull(workouts.deletedAt)),
      with: {
        blocks: {
          where: isNull(workoutBlocks.deletedAt),
          orderBy: asc(workoutBlocks.position),
          with: {
            items: {
              where: isNull(workoutItems.deletedAt),
              orderBy: asc(workoutItems.position),
              with: { targetSets: { where: isNull(workoutItemSets.deletedAt), orderBy: asc(workoutItemSets.position) } },
            },
          },
        },
      },
    }),
    [id],
  );
  const machineMap = useMachineMap();
  const location = useLocation(workout?.locationId);
  const runs = useRoutineSessions(id);
  const [now] = useState(Date.now);
  const [allRuns, setAllRuns] = useState(false);
  const { data: wodRuns } = useLiveQuery(
    db
      .select({ block: sessionBlocks })
      .from(sessionBlocks)
      .innerJoin(workoutBlocks, eq(workoutBlocks.id, sessionBlocks.workoutBlockId))
      .innerJoin(sessions, eq(sessions.id, sessionBlocks.sessionId))
      .where(
        and(
          eq(workoutBlocks.workoutId, id),
          isNotNull(sessionBlocks.finishedAt),
          isNull(sessionBlocks.deletedAt),
          isNull(sessions.deletedAt),
        ),
      ),
    [id],
  );

  if (!workout) return null;

  // Best result of each scored WOD block (AMRAP / For Time / Tabata), over all its runs.
  const bestByBlock = new Map<string, SessionBlock>();
  for (const { block: run } of wodRuns) {
    if (!run.workoutBlockId || run.kind === 'exercises' || run.kind === 'emom') continue;
    const cur = bestByBlock.get(run.workoutBlockId);
    if (!cur || compareWodResults(run.kind, run, cur) > 0) bestByBlock.set(run.workoutBlockId, run);
  }

  const kinds = workout.blocks.map((b) => b.kind);
  const strength = !kinds.length || kinds.includes('exercises');
  const plainItems = workout.blocks.filter((b) => b.kind === 'exercises').flatMap((b) => b.items);
  const allItems = workout.blocks.flatMap((b) => b.items);
  const avgSec = runs.length ? runs.reduce((acc, r) => acc + durationSec(r), 0) / runs.length : null;
  const stats = [
    { value: String(strength ? plainItems.length : allItems.length), label: 'exercícios' },
    strength
      ? { value: String(plainItems.reduce((n, i) => n + i.targetSets.length, 0)), label: 'séries' }
      : { value: String(workout.blocks.length), label: workout.blocks.length === 1 ? 'bloco' : 'blocos' },
    { value: avgSec != null ? formatMinutes(avgSec) : '—', label: 'duração média' },
  ];
  const shownRuns = allRuns ? runs : runs.slice(0, 3);

  const start = async () => {
    setStarting(true);
    try {
      await beginRoutine(workout.id);
    } finally {
      setStarting(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('Excluir treino?', 'O histórico de execuções será mantido.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(workout.id);
          router.back();
        },
      },
    ]);

  /** Machine, or the equipment used when the exercise has several. */
  const toolOf = (item: (typeof allItems)[number]) =>
    item.machineId
      ? (machineMap.get(item.machineId)?.name ?? null)
      : item.equipment && (exerciseMap.get(item.exerciseId)?.equipment.length ?? 0) > 1
        ? equipmentLabel(item.equipment)
        : null;
  const openExercise = (exerciseId: string) => router.push({ pathname: '/exercise/[id]', params: { id: exerciseId } });

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton
                icon="pencil-outline"
                accessibilityLabel="Editar rotina"
                onPress={() => router.push({ pathname: '/workout/edit', params: { id: workout.id } })}
              />
              <Menu
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                anchor={<IconButton icon="dots-vertical" accessibilityLabel="Mais opções" onPress={() => setMenuOpen(true)} />}>
                <Menu.Item
                  leadingIcon="content-copy"
                  title="Duplicar"
                  onPress={async () => {
                    setMenuOpen(false);
                    const copy = await duplicateWorkout(workout.id);
                    if (copy) router.replace({ pathname: '/workout/[id]', params: { id: copy } });
                  }}
                />
                <Menu.Item
                  leadingIcon="delete"
                  title="Excluir"
                  onPress={() => {
                    setMenuOpen(false);
                    confirmDelete();
                  }}
                />
              </Menu>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: strength ? STRENGTH_TINT : theme.colors.secondaryContainer }]}>
            <Icon
              source={workoutIcon(kinds)}
              size={24}
              color={strength ? theme.colors.primary : theme.colors.onSecondaryContainer}
            />
          </View>
          <View style={styles.flex}>
            <Text variant="headlineSmall" style={styles.title}>
              {workout.name}
            </Text>
            <Text variant="bodyMedium" style={styles.muted}>
              {runs.length
                ? `Feito ${relativeDays(runs[0].startedAt, now)} · ${plural(runs.length, 'vez', 'vezes')} no total`
                : 'Nunca feito'}
            </Text>
          </View>
        </View>
        {location && (
          <View style={styles.chips}>
            <Chip
              icon="map-marker-outline"
              style={{ backgroundColor: theme.colors.secondaryContainer }}
              textStyle={{ color: theme.colors.onSecondaryContainer }}>
              {location.name}
            </Chip>
          </View>
        )}
        {workout.notes ? <Text variant="bodyMedium">{workout.notes}</Text> : null}

        <View style={[styles.stats, { backgroundColor: theme.colors.elevation.level1 }]}>
          {stats.map((st) => (
            <View key={st.label} style={styles.stat}>
              <Text variant="titleLarge" style={styles.title}>
                {st.value}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                {st.label}
              </Text>
            </View>
          ))}
        </View>

        {strength && plainItems.length > 0 && (
          <Text variant="titleMedium" style={styles.section}>
            Exercícios
          </Text>
        )}
        {workout.blocks.map((block) => {
          if (!isWod(block.kind)) {
            if (!block.items.length) return null;
            return (
              <Card key={block.id} mode="contained" style={styles.clip}>
                {block.items.map((item, i) => {
                  const tool = toolOf(item);
                  return (
                    <View key={item.id}>
                      {i > 0 && <Divider />}
                      <TouchableRipple onPress={() => openExercise(item.exerciseId)} accessibilityRole="button">
                        <View style={styles.exerciseRow}>
                          <ExerciseThumb exerciseId={item.exerciseId} equipment={item.equipment} size={48} />
                          <View style={styles.flex}>
                            <Text variant="titleSmall">{exerciseMap.get(item.exerciseId)?.name ?? '—'}</Text>
                            <Text variant="bodyMedium">
                              {item.targetSets.length ? describeTargets(item.targetSets) : describeItem(item, block.kind)}
                            </Text>
                            {tool && (
                              <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
                                {tool}
                              </Text>
                            )}
                          </View>
                          <Icon source="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                        </View>
                      </TouchableRipple>
                    </View>
                  );
                })}
              </Card>
            );
          }
          const best = bestByBlock.get(block.id);
          return (
            <Card key={block.id} mode="outlined" style={[styles.clip, { borderColor: theme.colors.secondaryContainer }]}>
              <View style={styles.wodHeader}>
                <View style={[styles.wodIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
                  <Icon source={BLOCK_KIND_ICON[block.kind]} size={20} color={theme.colors.onSecondaryContainer} />
                </View>
                <View style={styles.flex}>
                  <Text variant="titleMedium">{describeBlockFormat(block)}</Text>
                  {block.alternate && (
                    <Text variant="bodySmall" style={styles.muted}>
                      Um movimento por intervalo, em sequência
                    </Text>
                  )}
                </View>
              </View>
              {block.items.map((item, i) => (
                <View key={item.id}>
                  <Divider />
                  <TouchableRipple onPress={() => openExercise(item.exerciseId)} accessibilityRole="button">
                    <View style={styles.movementRow}>
                      <Text variant="bodyLarge" style={styles.flex}>
                        {block.alternate ? `${i + 1}. ` : ''}
                        {exerciseMap.get(item.exerciseId)?.name ?? '—'}
                      </Text>
                      <Text variant="bodyMedium" style={styles.muted}>
                        {describeItem(item, block.kind)}
                      </Text>
                    </View>
                  </TouchableRipple>
                </View>
              ))}
              {best && (
                // A View, not a Fragment: Card passes `index`/`total` props to its direct children.
                <View>
                  <Divider />
                  <View style={[styles.movementRow, { backgroundColor: theme.colors.elevation.level2 }]}>
                    <Icon source="trophy-outline" size={18} color={theme.colors.onTertiaryContainer} />
                    <Text variant="titleSmall" style={[styles.flex, { color: theme.colors.onTertiaryContainer }]}>
                      Melhor: {describeResult(best)}
                    </Text>
                    {best.finishedAt && (
                      <Text variant="bodySmall" style={styles.muted}>
                        {formatDate(best.finishedAt)}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </Card>
          );
        })}

        {runs.length > 0 && (
          <View style={styles.runs}>
            <View style={styles.runsHeader}>
              <Text variant="titleMedium">Execuções anteriores</Text>
              {runs.length > 3 && (
                <Button compact onPress={() => setAllRuns((v) => !v)}>
                  {allRuns ? 'Ver menos' : `Ver todas (${runs.length})`}
                </Button>
              )}
            </View>
            {shownRuns.map((r) => (
              <SessionCard key={r.id} session={r} />
            ))}
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button mode="contained" icon="play" contentStyle={styles.startBtn} onPress={start} loading={starting}>
          Iniciar treino
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { padding: 12, gap: 12, paddingBottom: 32 },
  headerActions: { flexDirection: 'row' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 },
  heroIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '700' },
  muted: { opacity: 0.7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 8 },
  stats: { flexDirection: 'row', borderRadius: 18, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  section: { marginTop: 8, paddingHorizontal: 4 },
  clip: { overflow: 'hidden' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  wodHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
  wodIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  movementRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 },
  runs: { gap: 8, marginTop: 8 },
  runsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4 },
  footer: { padding: 16 },
  startBtn: { height: 52 },
});
