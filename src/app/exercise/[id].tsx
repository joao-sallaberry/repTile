import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Card, IconButton, List, Text } from 'react-native-paper';

import { BarChart } from '@/components/bar-chart';
import { MEASURE_LABEL } from '@/components/exercise-picker';
import { db } from '@/db/client';
import { exercises, sessionSets } from '@/db/schema';
import { performedSets } from '@/features/session/repo';
import { computePRs, estimateOneRepMax, type PerformedSet } from '@/features/stats/prs';
import { deleteExercise } from '@/features/workouts/repo';
import { formatDate, formatWeight } from '@/lib/format';

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: exercise } = useLiveQuery(db.query.exercises.findFirst({ where: eq(exercises.id, id) }), [id]);
  // Reload whenever any set changes.
  const { updatedAt } = useLiveQuery(db.select({ id: sessionSets.id }).from(sessionSets).where(eq(sessionSets.exerciseId, id)), [id]);
  const [sets, setSets] = useState<PerformedSet[]>([]);

  useEffect(() => {
    performedSets(id).then(setSets);
  }, [id, updatedAt]);

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
      <Text variant="bodyMedium">
        {exercise.category} · {MEASURE_LABEL[exercise.measure]}
      </Text>

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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexBasis: '48%', flexGrow: 1 },
  empty: { textAlign: 'center', padding: 24, opacity: 0.7 },
});
