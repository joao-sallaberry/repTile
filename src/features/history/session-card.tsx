import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

import type { RecentSession } from '@/features/home/queries';
import { formatMinutes, formatVolume } from '@/features/home/stats';
import { useLocations } from '@/features/places/queries';
import { describeBlockFormat } from '@/features/workouts/blocks';
import { describeResult } from '@/features/workouts/describe';

const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const durationSec = (s: { startedAt: number; finishedAt: number | null }) =>
  ((s.finishedAt ?? s.startedAt) - s.startedAt) / 1000;

/** One finished session: weekday and day, name, duration · volume · sets (or the WOD), place, and its result or PR count. */
export function SessionCard({ session: s }: { session: RecentSession }) {
  const theme = useTheme();
  const locations = useLocations();
  const date = new Date(s.startedAt);
  const duration = s.finishedAt ? formatMinutes(durationSec(s)) : null;
  const wod = s.wods[0];
  const result = !s.volume && wod?.finishedAt ? describeResult({ ...wod, rx: true })?.replace(/ · Rx$/, '') : null;
  const meta = [
    duration,
    ...(s.volume ? [formatVolume(s.volume), plural(s.sets, 'série', 'séries')] : wod ? [describeBlockFormat(wod)] : []),
  ]
    .filter(Boolean)
    .join(' · ');
  const place = s.locationId ? locations.find((l) => l.id === s.locationId)?.name : undefined;

  return (
    <Card mode="contained" onPress={() => router.push({ pathname: '/history/[id]', params: { id: s.id } })}>
      <View style={styles.sessionRow}>
        <View style={styles.date}>
          <Text variant="labelSmall" style={styles.muted}>
            {weekdayFmt.format(date).replace('.', '').toUpperCase()}
          </Text>
          <Text variant="titleLarge">{date.getDate()}</Text>
        </View>
        <View style={styles.sessionText}>
          <Text variant="titleSmall" numberOfLines={1}>
            {s.name}
          </Text>
          {meta ? (
            <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          {place && (
            <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
              {place}
            </Text>
          )}
        </View>
        {result ? (
          <View style={styles.result}>
            <Text variant="titleMedium">{result}</Text>
            <Text variant="labelSmall" style={{ color: theme.colors.secondary }}>
              {[wod.rx ? 'RX' : 'SCALED', wod.isPr ? 'PR' : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : (
          s.prs > 0 && (
            <Text
              variant="labelSmall"
              style={[styles.badge, { backgroundColor: theme.colors.tertiaryContainer, color: theme.colors.onTertiaryContainer }]}>
              {plural(s.prs, 'PR', 'PRs')}
            </Text>
          )
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  muted: { opacity: 0.7 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14 },
  date: { width: 40, alignItems: 'center' },
  sessionText: { flex: 1, gap: 3 },
  result: { alignItems: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
});
