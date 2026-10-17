import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, IconButton, List, Menu, Text, useTheme } from 'react-native-paper';

import { db } from '@/db/client';
import { sessionBlocks, sessions, workoutBlocks, workoutItems, workoutItemSets, workouts, type SessionBlock } from '@/db/schema';
import { useLocation, useMachineMap } from '@/features/places/queries';
import { beginRoutine } from '@/features/session/begin';
import { compareWodResults } from '@/features/stats/prs';
import { BLOCK_KIND_ICON, describeBlockFormat, isWod } from '@/features/workouts/blocks';
import { describeItem, describeResult, describeTargets } from '@/features/workouts/describe';
import { useExerciseMap } from '@/features/workouts/queries';
import { deleteWorkout, duplicateWorkout } from '@/features/workouts/repo';
import { formatDate } from '@/lib/format';

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
  const { data: history } = useLiveQuery(
    db
      .select()
      .from(sessions)
      .where(and(eq(sessions.workoutId, id), isNull(sessions.deletedAt), isNotNull(sessions.finishedAt)))
      .orderBy(desc(sessions.startedAt))
      .limit(20),
    [id],
  );
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


  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: workout.name,
          headerRight: () => (
            <Menu
              visible={menuOpen}
              onDismiss={() => setMenuOpen(false)}
              anchor={<IconButton icon="dots-vertical" onPress={() => setMenuOpen(true)} />}>
              <Menu.Item
                leadingIcon="pencil"
                title="Editar"
                onPress={() => {
                  setMenuOpen(false);
                  router.push({ pathname: '/workout/edit', params: { id: workout.id } });
                }}
              />
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
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {location && (
          <View style={styles.chips}>
            <Chip icon="map-marker-outline">{location.name}</Chip>
          </View>
        )}
        {workout.notes ? <Text variant="bodyMedium">{workout.notes}</Text> : null}

        {workout.blocks.map((block) => {
          const wod = isWod(block.kind);
          const best = bestByBlock.get(block.id);
          return (
            <Card
              key={block.id}
              mode={wod ? 'outlined' : 'contained'}
              style={wod ? { borderColor: theme.colors.secondary } : undefined}>
              {wod && (
                <Card.Title
                  title={describeBlockFormat(block)}
                  subtitle={block.alternate ? 'Um movimento por intervalo, em sequência' : undefined}
                  left={(p) => <List.Icon {...p} icon={BLOCK_KIND_ICON[block.kind]} color={theme.colors.secondary} />}
                />
              )}
              {block.items.map((item, i) => (
                <View key={item.id}>
                  {(i > 0 || wod) && <Divider />}
                  <List.Item
                    title={`${block.alternate ? `${i + 1}. ` : ''}${exerciseMap.get(item.exerciseId)?.name ?? '—'}`}
                    description={
                      [
                        !wod && item.targetSets.length ? describeTargets(item.targetSets) : describeItem(item, block.kind),
                        item.machineId ? `⚙ ${machineMap.get(item.machineId)?.name ?? ''}` : null,
                      ]
                        .filter(Boolean)
                        .join('\n') || undefined
                    }
                    descriptionNumberOfLines={3}
                    onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.exerciseId } })}
                  />
                </View>
              ))}
              {best && (
                // A View, not a Fragment: Card passes `index`/`total` props to its direct children.
                <View>
                  <Divider />
                  <List.Item
                    title={`Melhor: ${describeResult(best)}`}
                    description={best.finishedAt ? formatDate(best.finishedAt) : undefined}
                    left={(p) => <List.Icon {...p} icon="trophy-outline" />}
                  />
                </View>
              )}
            </Card>
          );
        })}

        {history.length > 0 && (
          <>
            <Text variant="titleMedium">Execuções anteriores</Text>
            <Card mode="contained">
              {history.map((s, i) => (
                <View key={s.id}>
                  {i > 0 && <Divider />}
                  <List.Item
                    title={formatDate(s.startedAt)}
                    onPress={() => router.push({ pathname: '/history/[id]', params: { id: s.id } })}
                  />
                </View>
              ))}
            </Card>
          </>
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
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { padding: 16 },
  startBtn: { height: 52 },
});
