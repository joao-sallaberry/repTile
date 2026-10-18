import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';

import { useLocations } from '@/features/places/queries';
import { describeBlockFormat } from '@/features/workouts/blocks';
import { describeResult } from '@/features/workouts/describe';

import { useRecentSessions } from './queries';
import { formatMinutes, formatVolume } from './stats';

const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

/** "Últimos treinos": one compact line per session (duration, volume or WOD result, location) and a PR badge. */
export function RecentSessions({ limit = 5 }: { limit?: number }) {
  const theme = useTheme();
  const recent = useRecentSessions(limit);
  const locations = useLocations();
  if (!recent.length) return null;
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="titleMedium">Últimos treinos</Text>
        <Button compact onPress={() => router.push('/history')}>
          Histórico
        </Button>
      </View>
      {recent.map((s) => {
        const date = new Date(s.startedAt);
        const duration = s.finishedAt ? formatMinutes((s.finishedAt - s.startedAt) / 1000) : null;
        // Volume for exercises; otherwise the first WOD's result (without Rx/Scaled), else its format.
        const firstWod = s.wods[0];
        const wodText = firstWod
          ? ((firstWod.finishedAt && describeResult({ ...firstWod, rx: true })?.replace(/ · Rx$/, '')) || describeBlockFormat(firstWod))
          : null;
        const place = s.locationId ? locationName.get(s.locationId) : undefined;
        const meta = [duration, s.volume ? formatVolume(s.volume) : wodText, place].filter(Boolean).join(' · ');
        return (
          <Card key={s.id} mode="contained" onPress={() => router.push({ pathname: '/history/[id]', params: { id: s.id } })}>
            <Card.Content style={styles.row}>
              <View style={styles.date}>
                <Text variant="labelSmall" style={styles.muted}>
                  {weekdayFmt.format(date).replace('.', '').toUpperCase()}
                </Text>
                <Text variant="titleMedium">{date.getDate()}</Text>
              </View>
              <View style={styles.flex}>
                <Text variant="titleSmall" numberOfLines={1}>
                  {s.name}
                </Text>
                {meta ? (
                  <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
                    {meta}
                  </Text>
                ) : null}
              </View>
              {s.prs > 0 && (
                <Text
                  variant="labelSmall"
                  style={[styles.badge, { backgroundColor: theme.colors.tertiaryContainer, color: theme.colors.onTertiaryContainer }]}>
                  {s.prs === 1 ? '1 PR' : `${s.prs} PRs`}
                </Text>
              )}
            </Card.Content>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  section: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  date: { width: 36, alignItems: 'center' },
  muted: { opacity: 0.7 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
});
