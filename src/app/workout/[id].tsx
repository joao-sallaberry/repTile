import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, IconButton, List, Menu, Text } from 'react-native-paper';

import { db } from '@/db/client';
import { sessions, workoutItems, workoutItemSets, workouts } from '@/db/schema';
import { useCurrentLocation } from '@/features/places/current';
import { useLocation, useMachineMap } from '@/features/places/queries';
import { getActiveSession, startSession } from '@/features/session/repo';
import { compareWodResults } from '@/features/stats/prs';
import { describeItem, describeResult, describeTargets, describeWorkoutFormat } from '@/features/workouts/describe';
import { useExerciseMap } from '@/features/workouts/queries';
import { deleteWorkout, duplicateWorkout } from '@/features/workouts/repo';
import { formatDate } from '@/lib/format';
import { WORKOUT_TYPE_LABEL } from '@/theme';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const exerciseMap = useExerciseMap();

  const { data: workout } = useLiveQuery(
    db.query.workouts.findFirst({
      where: and(eq(workouts.id, id), isNull(workouts.deletedAt)),
      with: {
        items: {
          where: isNull(workoutItems.deletedAt),
          orderBy: asc(workoutItems.position),
          with: { targetSets: { where: isNull(workoutItemSets.deletedAt), orderBy: asc(workoutItemSets.position) } },
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

  if (!workout) return null;

  const best =
    workout.type === 'amrap' || workout.type === 'for_time'
      ? history.reduce<(typeof history)[number] | null>(
          (b, s) => (!b || compareWodResults(workout.type as 'amrap', s, b) > 0 ? s : b),
          null,
        )
      : null;

  const start = async () => {
    const active = await getActiveSession();
    const go = async () => {
      setStarting(true);
      try {
        const sessionId = await startSession(workout.id, useCurrentLocation.getState().id);
        router.push({ pathname: '/session/[id]', params: { id: sessionId } });
      } finally {
        setStarting(false);
      }
    };
    if (active) {
      Alert.alert('Treino em andamento', `Você ainda não finalizou "${active.name}".`, [
        { text: 'Retomar', onPress: () => router.push({ pathname: '/session/[id]', params: { id: active.id } }) },
        { text: 'Iniciar novo mesmo assim', onPress: go },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    } else {
      await go();
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

  const format = describeWorkoutFormat(workout);

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
        <View style={styles.chips}>
          <Chip icon="tag">{WORKOUT_TYPE_LABEL[workout.type]}</Chip>
          {format && <Chip icon="timer-outline">{format}</Chip>}
          {location && <Chip icon="map-marker-outline">{location.name}</Chip>}
        </View>
        {workout.notes ? <Text variant="bodyMedium">{workout.notes}</Text> : null}

        <Card mode="contained">
          {workout.items.map((item, i) => (
            <View key={item.id}>
              {i > 0 && <Divider />}
              <List.Item
                title={exerciseMap.get(item.exerciseId)?.name ?? '—'}
                description={
                  [
                    workout.type === 'strength' && item.targetSets.length
                      ? describeTargets(item.targetSets)
                      : describeItem(item, workout.type),
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
        </Card>

        {best && (
          <Card mode="outlined">
            <Card.Title title="Melhor resultado" subtitle={`${describeResult(best)} · ${formatDate(best.startedAt)}`} left={(p) => <List.Icon {...p} icon="trophy" />} />
          </Card>
        )}

        {history.length > 0 && (
          <>
            <Text variant="titleMedium">Execuções anteriores</Text>
            <Card mode="contained">
              {history.map((s, i) => (
                <View key={s.id}>
                  {i > 0 && <Divider />}
                  <List.Item
                    title={formatDate(s.startedAt)}
                    description={describeResult(s) ?? undefined}
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
