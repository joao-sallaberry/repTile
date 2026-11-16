import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Card, IconButton, Text, useTheme } from 'react-native-paper';

import { freezeWhenBlurred } from '@/components/freeze-when-blurred';
import { FilterChips } from '@/components/filter-chips';
import { addMonths, groupByWeek, monthBounds, monthGrid, monthOf, type DayCell, type Month } from '@/features/history/calendar';
import { useHistoryOverview, useSessionsBetween, type RecentSession } from '@/features/home/queries';
import { formatMinutes, formatVolume } from '@/features/home/stats';
import { durationSec, plural, SessionCard } from '@/features/history/session-card';

const WEEKDAY_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

type Filter = { kind: 'all' } | { kind: 'prs' } | { kind: 'wod' } | { kind: 'routine'; id: string };

function matches(s: RecentSession, filter: Filter) {
  if (filter.kind === 'prs') return s.prs > 0;
  if (filter.kind === 'wod') return s.wods.length > 0;
  if (filter.kind === 'routine') return s.workoutId === filter.id;
  return true;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sum = (list: RecentSession[], f: (s: RecentSession) => number) => list.reduce((acc, s) => acc + f(s), 0);

/** "5 treinos · 4h31 · 3 PRs" */
function weekSummary(items: RecentSession[]) {
  const prs = sum(items, (s) => s.prs);
  return [plural(items.length, 'treino', 'treinos'), formatMinutes(sum(items, durationSec)), prs ? plural(prs, 'PR', 'PRs') : null]
    .filter(Boolean)
    .join(' · ');
}

function HistoryScreen() {
  const theme = useTheme();
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const [month, setMonth] = useState<Month>(() => monthOf(Date.now()));
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });

  const { start, end } = monthBounds(month);
  const list = useSessionsBetween(start, end);
  const overview = useHistoryOverview();
  const rows = useMemo(() => monthGrid(month, list, now), [month, list, now]);

  const current = monthOf(now);
  const isCurrent = month.year === current.year && month.month === current.month;
  const first = overview.firstAt != null ? monthOf(overview.firstAt) : current;
  const isFirst = month.year < first.year || (month.year === first.year && month.month <= first.month);
  const changeMonth = (n: number) => {
    setMonth(addMonths(month, n));
    setFilter({ kind: 'all' });
  };

  const totals = { sec: sum(list, durationSec), volume: sum(list, (s) => s.volume), prs: sum(list, (s) => s.prs) };

  const routines = [...new Map(list.flatMap((s) => (s.workoutId ? [[s.workoutId, s.name] as const] : []))).entries()];
  const chips: { key: string; label: string; filter: Filter }[] = [
    { key: 'all', label: 'Todos', filter: { kind: 'all' } },
    ...(list.some((s) => s.prs > 0) ? [{ key: 'prs', label: 'Com recordes', filter: { kind: 'prs' } as Filter }] : []),
    ...(list.some((s) => s.wods.length) && list.some((s) => !s.wods.length)
      ? [{ key: 'wod', label: 'WOD', filter: { kind: 'wod' } as Filter }]
      : []),
    ...(routines.length > 1
      ? routines.map(([id, name]) => ({ key: id, label: name, filter: { kind: 'routine', id } as Filter }))
      : []),
  ];
  const chipKey = filter.kind === 'routine' ? filter.id : filter.kind;
  const weeks = groupByWeek(
    list.filter((s) => matches(s, filter)),
    now,
  );

  return (
    <View style={styles.flex}>
      <Appbar.Header>
        <Appbar.Content title="Histórico" titleStyle={styles.appTitle} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
        {overview.count > 0 && overview.firstAt != null && (
          <Text variant="bodyMedium" style={[styles.muted, styles.inset]}>
            {plural(overview.count, 'treino', 'treinos')} desde {monthFmt.format(overview.firstAt)}
          </Text>
        )}

        <Card mode="contained">
          <Card.Content style={styles.month}>
            <View style={styles.monthHeader}>
              <IconButton icon="chevron-left" accessibilityLabel="Mês anterior" disabled={isFirst} onPress={() => changeMonth(-1)} />
              <Text variant="titleMedium" style={styles.monthTitle}>
                {capitalize(monthFmt.format(start))}
              </Text>
              <IconButton icon="chevron-right" accessibilityLabel="Próximo mês" disabled={isCurrent} onPress={() => changeMonth(1)} />
            </View>
            <View style={styles.week}>
              {WEEKDAY_LETTERS.map((l, i) => (
                <Text key={i} variant="labelSmall" style={[styles.cell, styles.muted]}>
                  {l}
                </Text>
              ))}
            </View>
            {rows.map((row, i) => (
              <View key={i} style={styles.week}>
                {row.map((c, j) => (
                  <View key={j} style={styles.cell}>
                    {c && <Day cell={c} />}
                  </View>
                ))}
              </View>
            ))}
            <View style={[styles.stats, { borderTopColor: theme.colors.outlineVariant }]}>
              <Stat value={String(list.length)} label={list.length === 1 ? 'treino' : 'treinos'} />
              <Stat value={formatMinutes(totals.sec)} label="no total" />
              <Stat value={formatVolume(totals.volume)} label="de volume" />
              <Stat value={plural(totals.prs, 'PR', 'PRs')} label="no mês" highlight={totals.prs > 0} />
            </View>
          </Card.Content>
        </Card>

        <FilterChips options={chips} value={chipKey} onChange={(key) => setFilter(chips.find((c) => c.key === key)!.filter)} />

        {weeks.map((w) => (
          <View key={w.key} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text variant="titleSmall" style={styles.muted}>
                {w.title}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                {weekSummary(w.items)}
              </Text>
            </View>
            {w.items.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </View>
        ))}

        {!list.length && (
          <View style={styles.empty}>
            {overview.count ? (
              <Text variant="bodyMedium" style={styles.muted}>
                Nenhum treino em {monthFmt.format(start).replace(/ de \d+$/, '')}.
              </Text>
            ) : (
              <>
                <Text variant="titleMedium">Nenhum treino registrado</Text>
                <Text variant="bodyMedium">Os treinos que você finalizar aparecem aqui.</Text>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Day({ cell }: { cell: DayCell }) {
  const theme = useTheme();
  const label = `${cell.day}${cell.state === 'done' ? ': treinou' : cell.state === 'today' ? ': hoje' : ''}${cell.pr ? ', recorde' : ''}`;
  if (cell.state === 'done') {
    return (
      <View accessible accessibilityLabel={label} style={[styles.dot, { backgroundColor: theme.colors.primary }]}>
        <Text variant="labelMedium" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>
          {cell.day}
        </Text>
        {cell.pr && (
          <View
            style={[styles.prDot, { backgroundColor: theme.colors.onTertiaryContainer, borderColor: theme.colors.elevation.level1 }]}
          />
        )}
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.dot, cell.state === 'today' && { borderWidth: 2, borderStyle: 'dashed', borderColor: theme.colors.primary }]}>
      <Text
        variant="labelMedium"
        style={{
          color:
            cell.state === 'today'
              ? theme.colors.primary
              : cell.state === 'future'
                ? theme.colors.onSurfaceDisabled
                : theme.colors.onSurfaceVariant,
        }}>
        {cell.day}
      </Text>
    </View>
  );
}

function Stat({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.flex}>
      <Text variant="titleMedium" style={highlight ? { color: theme.colors.onTertiaryContainer } : undefined}>
        {value}
      </Text>
      <Text variant="bodySmall" style={styles.muted}>
        {label}
      </Text>
    </View>
  );
}

/** One finished session: date, name, duration/volume/sets (or the WOD format), location; PRs or the WOD result on the right. */
const styles = StyleSheet.create({
  flex: { flex: 1 },
  appTitle: { fontWeight: '700' },
  content: { padding: 12, paddingTop: 0, gap: 12, paddingBottom: 32 },
  inset: { paddingHorizontal: 4 },
  muted: { opacity: 0.7 },
  month: { gap: 6, paddingHorizontal: 12 },
  monthHeader: { flexDirection: 'row', alignItems: 'center' },
  monthTitle: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', textAlign: 'center' },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  prDot: { position: 'absolute', top: -2, right: -2, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  group: { gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 },
  empty: { alignItems: 'center', padding: 32, gap: 8 },
});

export default freezeWhenBlurred(HistoryScreen);
