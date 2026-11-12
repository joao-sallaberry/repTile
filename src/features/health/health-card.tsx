import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text, useTheme } from 'react-native-paper';

import type { SessionHealth } from '@/db/schema';

import { exerciseName, sourceLabel } from './match';

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const CHART_HEIGHT = 72;

/** Stat tiles for a linked session: average/max heart rate and calories. */
export function healthStats(h: SessionHealth | undefined) {
  if (!h) return [];
  return [
    ...(h.avgHr ? [{ label: 'FC média', value: `${h.avgHr} bpm`, note: h.maxHr ? `máx. ${h.maxHr} bpm` : null }] : []),
    ...(h.calories ? [{ label: 'Calorias', value: `${h.calories} kcal`, note: null }] : []),
  ];
}

/** The linked Health Connect record: name, source and time, with a heart rate bar chart (one bar per minute). */
export function HealthCard({ health }: { health: SessionHealth }) {
  const theme = useTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const series = health.hrSeries ?? [];
  const values = series.filter((v): v is number => v != null);
  const top = values.length ? Math.max(...values) : 0;
  const floor = values.length ? Math.max(0, Math.min(...values) - 10) : 0;
  const source = sourceLabel(health.source);
  const span =
    health.startedAt && health.finishedAt
      ? `${timeFmt.format(health.startedAt)} – ${timeFmt.format(health.finishedAt)}`
      : null;

  return (
    <Card mode="contained" style={styles.clip}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: theme.colors.errorContainer }]}>
          <Icon source="heart-pulse" size={20} color={theme.colors.onErrorContainer} />
        </View>
        <View style={styles.flex}>
          <Text variant="titleSmall">{exerciseName(health)}</Text>
          <Text variant="bodySmall" style={muted} numberOfLines={1}>
            {[source, span].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      {values.length > 1 ? (
        <View style={styles.chartBox}>
          <View style={styles.chart} accessibilityLabel={`Frequência cardíaca: média ${health.avgHr}, máxima ${health.maxHr} bpm`}>
            {series.map((v, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: v == null ? 0 : Math.max(2, ((v - floor) / Math.max(1, top - floor)) * CHART_HEIGHT),
                    backgroundColor: v != null && v === top ? theme.colors.error : theme.colors.primary,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.legend}>
            <Text variant="bodySmall" style={muted}>
              mín. {health.minHr} · média {health.avgHr} · máx. {health.maxHr} bpm
            </Text>
          </View>
        </View>
      ) : (
        <Text variant="bodySmall" style={[muted, styles.empty]}>
          Sem frequência cardíaca neste horário.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  clip: { overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chartBox: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  chart: { height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  legend: { flexDirection: 'row', justifyContent: 'flex-end' },
  empty: { paddingHorizontal: 14, paddingBottom: 12 },
});
