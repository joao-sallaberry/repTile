import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, Divider, IconButton, List, Text, useTheme } from 'react-native-paper';

import { SetBadge } from '@/components/set-badge';
import { db } from '@/db/client';
import { sessionBlocks, sessions, sessionSets, type SessionSet } from '@/db/schema';
import { useLocation, useMachineMap } from '@/features/places/queries';
import { deleteSession } from '@/features/session/repo';
import { countsTowardStats, setLabels } from '@/features/session/sets';
import { BLOCK_KIND_ICON, describeBlockFormat, isWod } from '@/features/workouts/blocks';
import { describeItem, describeResult, describeRounds } from '@/features/workouts/describe';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatDate, formatDuration, formatWeight } from '@/lib/format';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const exerciseMap = useExerciseMap();
  const machineMap = useMachineMap();
  const { data: session } = useLiveQuery(db.query.sessions.findFirst({ where: eq(sessions.id, id) }), [id]);
  const { data: blocks } = useLiveQuery(
    db
      .select()
      .from(sessionBlocks)
      .where(and(eq(sessionBlocks.sessionId, id), isNull(sessionBlocks.deletedAt)))
      .orderBy(asc(sessionBlocks.position)),
    [id],
  );
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

  const plainBlocks = new Set(blocks.filter((b) => b.kind === 'exercises').map((b) => b.id));
  const plainSets = sets.filter((s) => s.sessionBlockId && plainBlocks.has(s.sessionBlockId));
  const volume = plainSets.reduce(
    (acc, s) => acc + (s.completedAt && countsTowardStats(s.type) ? (s.weight ?? 0) * (s.reps ?? 0) : 0),
    0,
  );
  const warmups = plainSets.filter((s) => s.completedAt && s.type === 'warmup').length;

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
        {session.finishedAt && (
          <Chip icon="clock-outline">{formatDuration((session.finishedAt - session.startedAt) / 1000)}</Chip>
        )}
        {location && <Chip icon="map-marker-outline">{location.name}</Chip>}
        {volume > 0 && <Chip icon="weight-kilogram">{formatWeight(volume)} de volume</Chip>}
        {warmups > 0 && <Chip icon="fire">{warmups} aquecimento{warmups > 1 ? 's' : ''}</Chip>}
      </View>
      {session.notes ? <Text variant="bodyMedium">“{session.notes}”</Text> : null}

      {blocks.map((block) => {
        const blockSets = sets.filter((s) => s.sessionBlockId === block.id);
        if (isWod(block.kind)) {
          const result = block.finishedAt ? describeResult(block) : null;
          return (
            <Card key={block.id} mode="outlined" style={{ borderColor: theme.colors.secondary }}>
              <Card.Title
                title={describeBlockFormat(block)}
                left={(p) => <List.Icon {...p} icon={BLOCK_KIND_ICON[block.kind]} color={theme.colors.secondary} />}
              />
              <Card.Content style={styles.result}>
                <Text variant="headlineSmall">{result ?? 'Não registrado'}</Text>
                {block.isPr && (
                  <Text
                    variant="labelSmall"
                    style={[styles.badge, { backgroundColor: theme.colors.tertiaryContainer, color: theme.colors.onTertiaryContainer }]}>
                    PR
                  </Text>
                )}
              </Card.Content>
              {describeRounds(block) && (
                <Card.Content>
                  <Text variant="bodyMedium" style={styles.rounds}>
                    {describeRounds(block)}
                  </Text>
                </Card.Content>
              )}
              {blockSets.map((s, i) => (
                <View key={s.id}>
                  <Divider />
                  <List.Item
                    title={`${block.alternate ? `${i + 1}. ` : ''}${exerciseMap.get(s.exerciseId)?.name ?? '—'}`}
                    description={describeItem(s, block.kind) || undefined}
                  />
                </View>
              ))}
            </Card>
          );
        }
        const groups = new Map<number, SessionSet[]>();
        for (const s of blockSets) groups.set(s.position, [...(groups.get(s.position) ?? []), s]);
        return [...groups.values()].map((list) => {
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
                    title={describeItem(s, 'amrap') || '—'}
                    left={() => <SetBadge type={s.type} label={labels[i]} />}
                    right={(p) => (s.completedAt ? <List.Icon {...p} icon="check" /> : null)}
                    style={styles.setItem}
                  />
                </View>
              ))}
            </Card>
          );
        });
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setItem: { paddingLeft: 16 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  rounds: { opacity: 0.75, paddingBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
});
