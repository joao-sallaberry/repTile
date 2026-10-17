import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text, useTheme } from 'react-native-paper';

import { useWeeklyGoal } from './goal';
import { useWeekSummary } from './queries';
import { formatMinutes, formatVolume, weekDays } from './stats';

/** "Esta semana": trained days (Sunday first), goal, time, volume and new PRs. */
export function WeekCard({ now, compact = false }: { now: number; compact?: boolean }) {
  const theme = useTheme();
  const goal = useWeeklyGoal((s) => s.goal);
  const week = useWeekSummary(now);
  const days = weekDays(
    week.sessions.map((s) => s.startedAt),
    now,
  );
  const count = week.sessions.length;
  const countText = goal ? `${count} de ${goal} treinos` : `${count} ${count === 1 ? 'treino' : 'treinos'}`;

  if (compact) {
    return (
      <Card mode="contained">
        <Card.Content style={styles.compact}>
          <View style={styles.flex}>
            <Text variant="labelLarge" style={styles.muted}>
              Esta semana
            </Text>
            <Text variant="titleMedium">{countText}</Text>
          </View>
          <Text variant="bodyMedium" style={styles.muted}>
            {formatVolume(week.volume)}
          </Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card mode="contained">
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <Text variant="titleMedium">Esta semana</Text>
          <Text variant="bodyMedium" style={styles.muted}>
            {countText}
          </Text>
        </View>
        <View style={styles.days}>
          {days.map((d) => (
            <View
              key={d.dayOfMonth}
              style={styles.day}
              accessible
              accessibilityLabel={`${d.dayOfMonth}: ${d.state === 'done' ? 'treinou' : d.state === 'today' ? 'hoje' : 'sem treino'}`}>
              <Text variant="labelSmall" style={styles.muted}>
                {d.label}
              </Text>
              {d.state === 'done' ? (
                <View style={[styles.dot, { backgroundColor: theme.colors.primary }]}>
                  <Icon source="check-bold" size={16} color={theme.colors.onPrimary} />
                </View>
              ) : (
                <View
                  style={[
                    styles.dot,
                    d.state === 'today'
                      ? { borderWidth: 2, borderStyle: 'dashed', borderColor: theme.colors.primary }
                      : { backgroundColor: theme.colors.elevation.level3 },
                  ]}>
                  <Text
                    variant="labelMedium"
                    style={{ color: d.state === 'today' ? theme.colors.primary : theme.colors.onSurfaceDisabled }}>
                    {d.dayOfMonth}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
        <View style={styles.stats}>
          <Stat value={formatMinutes(week.trainedSec)} label="treinando" />
          <Stat value={formatVolume(week.volume)} label="de volume" />
          <Stat
            value={`${week.prs} ${week.prs === 1 ? 'PR' : 'PRs'}`}
            label={week.prs === 1 ? 'novo' : 'novos'}
            color={week.prs ? theme.colors.onTertiaryContainer : undefined}
          />
        </View>
      </Card.Content>
    </Card>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.flex}>
      <Text variant="titleMedium" style={color ? { color } : undefined}>
        {value}
      </Text>
      <Text variant="bodySmall" style={styles.muted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 14 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  muted: { opacity: 0.7 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 6 },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
});
