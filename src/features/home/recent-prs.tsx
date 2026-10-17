import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Icon, Text, useTheme } from 'react-native-paper';

import { useMachineMap } from '@/features/places/queries';
import { estimateOneRepMax } from '@/features/stats/prs';
import { describeResult } from '@/features/workouts/describe';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatWeight } from '@/lib/format';

import { useRecentPrs } from './queries';
import { relativeDays } from './stats';

/** "Recordes recentes": a horizontal strip of the latest PRs. */
export function RecentPrs({ now }: { now: number }) {
  const theme = useTheme();
  const prs = useRecentPrs();
  const exerciseMap = useExerciseMap();
  const machineMap = useMachineMap();
  if (!prs.length) return null;

  return (
    <View style={styles.section}>
      <Text variant="titleMedium" style={styles.title}>
        Recordes recentes
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {prs.map((pr) => {
          const isSet = pr.kind === 'set';
          const title = isSet ? (exerciseMap.get(pr.exerciseId)?.name ?? 'Exercício') : pr.session.name;
          const value = isSet ? `${formatWeight(pr.weight)} × ${pr.reps}` : (describeResult(pr.session) ?? '—');
          const detail = isSet
            ? pr.machineId
              ? (machineMap.get(pr.machineId)?.name ?? 'Máquina')
              : `1RM est. ${formatWeight(Math.round(estimateOneRepMax(pr.weight, pr.reps)))}`
            : 'WOD';
          return (
            <Card
              key={pr.key}
              mode="contained"
              style={styles.card}
              onPress={() =>
                isSet
                  ? router.push({ pathname: '/exercise/[id]', params: { id: pr.exerciseId } })
                  : router.push({ pathname: '/history/[id]', params: { id: pr.session.id } })
              }>
              <Card.Content style={styles.cardContent}>
                <View style={styles.when}>
                  <Icon source="trophy-outline" size={14} color={theme.colors.onTertiaryContainer} />
                  <Text variant="labelSmall" style={{ color: theme.colors.onTertiaryContainer }}>
                    {relativeDays(pr.at, now).toUpperCase()}
                  </Text>
                </View>
                <Text variant="labelLarge" numberOfLines={1}>
                  {title}
                </Text>
                <Text variant="titleMedium">{value}</Text>
                <Text variant="bodySmall" numberOfLines={1} style={styles.muted}>
                  {detail}
                </Text>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, marginHorizontal: -16 },
  title: { paddingHorizontal: 20 },
  strip: { gap: 8, paddingHorizontal: 16 },
  card: { width: 160 },
  cardContent: { gap: 4, paddingHorizontal: 12 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  muted: { opacity: 0.7 },
});
