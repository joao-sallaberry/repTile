import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, Divider, IconButton, List, Text } from 'react-native-paper';

import { SetBadge } from '@/components/set-badge';

import { db } from '@/db/client';
import { sessions, sessionSets, type SessionSet } from '@/db/schema';
import { useLocation, useMachineMap } from '@/features/places/queries';
import { deleteSession } from '@/features/session/repo';
import { countsTowardStats, setLabels } from '@/features/session/sets';
import { describeItem, describeResult, describeWorkoutFormat } from '@/features/workouts/describe';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatDate, formatDuration, formatWeight } from '@/lib/format';
import { WORKOUT_TYPE_LABEL } from '@/theme';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseMap = useExerciseMap();
  const machineMap = useMachineMap();
  const { data: session } = useLiveQuery(db.query.sessions.findFirst({ where: eq(sessions.id, id) }), [id]);
  const { data: sets } = useLiveQuery(
    db
      .select()
      .from(sessionSets)
      .where(and(eq(sessionSets.sessionId, id), isNull(sessionSets.deletedAt)))
      .orderBy(asc(sessionSets.position), asc(sessionSets.setIndex)),
    [id],
  );

  const location = useLocation(session?.locationId);
  if (!session) return null;

  const groups = new Map<number, SessionSet[]>();
  for (const s of sets) groups.set(s.position, [...(groups.get(s.position) ?? []), s]);
  const volume = sets.reduce(
    (acc, s) => acc + (s.completedAt && countsTowardStats(s.type) ? (s.weight ?? 0) * (s.reps ?? 0) : 0),
    0,
  );
  const warmups = sets.filter((s) => s.completedAt && s.type === 'warmup').length;
  const result = describeResult(session);

  const confirmDelete = () =>
    Alert.alert('Excluir do histórico?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(session.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{ title: session.name, headerRight: () => <IconButton icon="delete-outline" onPress={confirmDelete} /> }}
      />
      <View style={styles.chips}>
        <Chip icon="calendar">{formatDate(session.startedAt)}</Chip>
        <Chip icon="tag">{WORKOUT_TYPE_LABEL[session.type]}</Chip>
        {session.finishedAt && (
          <Chip icon="clock-outline">{formatDuration((session.finishedAt - session.startedAt) / 1000)}</Chip>
        )}
        {location && <Chip icon="map-marker-outline">{location.name}</Chip>}
        {volume > 0 && <Chip icon="weight-kilogram">{formatWeight(volume)} de volume</Chip>}
        {warmups > 0 && <Chip icon="fire">{warmups} aquecimento{warmups > 1 ? 's' : ''}</Chip>}
      </View>

      {result && (
        <Card mode="contained">
          <Card.Content>
            <Text variant="labelLarge">{describeWorkoutFormat(session)}</Text>
            <Text variant="headlineMedium">{result}</Text>
          </Card.Content>
        </Card>
      )}
      {session.notes ? <Text variant="bodyMedium">“{session.notes}”</Text> : null}

      {[...groups.values()].map((list) => {
        const ex = exerciseMap.get(list[0].exerciseId);
        const machine = list[0].machineId ? machineMap.get(list[0].machineId) : undefined;
        const labels = setLabels(list.map((s) => s.type));
        return (
          <Card key={list[0].id} mode="outlined">
            <Card.Title
              title={ex?.name ?? '—'}
              subtitle={machine ? `⚙ ${machine.name}` : undefined}
              right={(p) => (
                <IconButton
                  {...p}
                  icon="chart-line"
                  onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: list[0].exerciseId } })}
                />
              )}
            />
            {list.map((s, i) => (
              <View key={s.id}>
                {i > 0 && <Divider />}
                <List.Item
                  title={session.type === 'strength' ? describeItem(s, 'amrap') || '—' : describeItem(s, session.type)}
                  left={() =>
                    session.type === 'strength' ? (
                      <SetBadge type={s.type} label={labels[i]} />
                    ) : (
                      <List.Icon icon="check-circle" />
                    )
                  }
                  right={(p) => (s.completedAt ? <List.Icon {...p} icon="check" /> : null)}
                  style={styles.setItem}
                />
              </View>
            ))}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setItem: { paddingLeft: 16 },
});
