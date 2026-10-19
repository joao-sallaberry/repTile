import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Card, IconButton, Text, useTheme } from 'react-native-paper';

import { FilterChips } from '@/components/filter-chips';import { addMonths, groupByWeek, monthBounds, monthGrid, monthOf, type DayCell, type Month } from '@/features/history/calendar';
import { useHistoryOverview, useSessionsBetween, type RecentSession } from '@/features/home/queries';
import { formatMinutes, formatVolume } from '@/features/home/stats';
import { useLocations } from '@/features/places/queries';
import { describeBlockFormat } from '@/features/workouts/blocks';
import { describeResult } from '@/features/workouts/describe';

const WEEKDAY_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

type Filter = { kind: 'all' } | { kind: 'prs' } | { kind: 'wod' } | { kind: 'routine'; id: string };

function matches(s: RecentSession, filter: Filter) {
  if (filter.kind === 'prs') return s.prs > 0;
  if (filter.kind === 'wod') return s.wods.length > 0;
  if (filter.kind === 'routine') return s.workoutId === filter.id;
  return true;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const durationSec = (s: RecentSession) => ((s.finishedAt ?? s.startedAt) - s.startedAt) / 1000;
const sum = (list: RecentSession[], f: (s: RecentSession) => number) => list.reduce((acc, s) => acc + f(s), 0);

/** "5 treinos · 4h31 · 3 PRs" */
function weekSummary(items: RecentSession[]) {
  const prs = sum(items, (s) => s.prs);
  return [plural(items.length, 'treino', 'treinos'), formatMinutes(sum(items, durationSec)), prs ? plural(prs, 'PR', 'PRs') : null]
    .filter(Boolean)
    .join(' · ');
}

export default function HistoryScreen() {
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
function SessionCard({ session: s }: { session: RecentSession }) {
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
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14 },
  date: { width: 40, alignItems: 'center' },
  sessionText: { flex: 1, gap: 3 },
  result: { alignItems: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  empty: { alignItems: 'center', padding: 32, gap: 8 },
});
