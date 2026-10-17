import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, Icon, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { equipmentText } from '@/components/exercise-picker';
import { db } from '@/db/client';
import { sessionBlocks, sessions, sessionSets, type SessionSet } from '@/db/schema';
import { formatMinutes, formatVolume, summarizeSets } from '@/features/home/stats';
import { useLocation, useMachineMap } from '@/features/places/queries';
import { updateRoutineFromSession } from '@/features/session/repo';
import { countsTowardStats } from '@/features/session/sets';
import { bestSet, describeSet, describeSetCounts, loadSessionRecords, type SessionRecord } from '@/features/session/summary';
import { BLOCK_KIND_ICON, describeBlockFormat, isWod } from '@/features/workouts/blocks';
import { describeResult, describeRounds } from '@/features/workouts/describe';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatDate } from '@/lib/format';

/** "Treino concluído!": shown right after finishing a workout (the history detail shows the same session later). */
export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const exerciseMap = useExerciseMap();
  const machineMap = useMachineMap();
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [routineUpdated, setRoutineUpdated] = useState(false);

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

  const plainBlockIds = useMemo(() => new Set(blocks.filter((b) => b.kind === 'exercises').map((b) => b.id)), [blocks]);
  const plainSets = useMemo(
    () => sets.filter((s) => s.completedAt && s.sessionBlockId && plainBlockIds.has(s.sessionBlockId)),
    [sets, plainBlockIds],
  );
  const wods = blocks.filter((b) => isWod(b.kind));

  useEffect(() => {
    if (sets.length || blocks.length) void loadSessionRecords(id, plainSets, blocks).then(setRecords);
  }, [id, plainSets, blocks, sets.length]);

  if (!session) return null;

  const { volume, sets: workSets } = summarizeSets(plainSets);
  const warmups = plainSets.filter((s) => s.type === 'warmup').length;
  const durationSec = ((session.finishedAt ?? session.startedAt) - session.startedAt) / 1000;

  // One row per exercise (sets grouped by position), only the ones with completed sets.
  const byPosition = new Map<number, SessionSet[]>();
  for (const s of plainSets) byPosition.set(s.position, [...(byPosition.get(s.position) ?? []), s]);
  const exercises = [...byPosition.values()];

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const updateRoutine = () =>
    Alert.alert('Atualizar rotina?', 'As metas da rotina passam a ser as séries, cargas e reps feitas hoje.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Atualizar',
        onPress: async () => {
          const changed = await updateRoutineFromSession(session.id);
          if (changed) setRoutineUpdated(true);
          else Alert.alert('Nada para atualizar', 'Nenhum exercício da rotina foi feito neste treino.');
        },
      },
    ]);

  const card = { backgroundColor: theme.colors.elevation.level2 };
  const muted = { color: theme.colors.onSurfaceVariant };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View style={[styles.trophy, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon source="trophy-outline" size={38} color={theme.colors.primary} />
        </View>
        <Text variant="headlineSmall" style={styles.bold}>
          Treino concluído!
        </Text>
        <Text variant="bodyMedium" style={[styles.center, muted]}>
          {session.name} · {formatDate(session.startedAt)}
        </Text>
        {location && (
          <View style={styles.row}>
            <Icon source="map-marker-outline" size={14} color={theme.colors.primary} />
            <Text variant="bodySmall">{location.name}</Text>
          </View>
        )}
      </View>

      <View style={styles.grid}>
        <Stat label="Duração" value={formatMinutes(durationSec)} style={card} />
        <Stat label="Volume" value={volume ? formatVolume(volume) : '—'} style={card} />
        <Stat
          label="Séries"
          value={String(workSets)}
          extra={warmups ? `+ ${warmups} aquec.` : undefined}
          style={card}
        />
        {records.length ? (
          <Stat
            label="Recordes"
            value={`${records.length} ${records.length === 1 ? 'PR' : 'PRs'}`}
            style={{ backgroundColor: theme.colors.tertiaryContainer }}
            color={theme.colors.onTertiaryContainer}
          />
        ) : (
          <Stat label="Recordes" value="—" style={card} />
        )}
      </View>

      {records.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.bold}>
            Novos recordes
          </Text>
          {records.map((r) => (
            <View key={r.key} style={[styles.record, card]}>
              <View style={[styles.recordIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                <Icon
                  source={r.kind === 'wod' ? 'flag-checkered' : r.what === 'maior carga' ? 'trophy-outline' : 'trending-up'}
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.flex}>
                <Text variant="titleSmall">
                  {r.kind === 'wod' ? r.title : `${exerciseMap.get(r.exerciseId)?.name ?? '—'} · ${r.what}`}
                </Text>
                <Text variant="bodySmall" style={muted}>
                  {r.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {exercises.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.bold}>
            Exercícios
          </Text>
          <View style={[styles.list, card]}>
            {exercises.map((group, i) => (
              <View key={group[0].id}>
                {i > 0 && <Divider />}
                <ExerciseRow group={group} exerciseMap={exerciseMap} machineMap={machineMap} />
              </View>
            ))}
          </View>
        </View>
      )}

      {wods.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.bold}>
            Blocos
          </Text>
          <View style={[styles.list, card]}>
            {wods.map((b, i) => (
              <View key={b.id}>
                {i > 0 && <Divider />}
                <View style={styles.listRow}>
                  <Icon source={BLOCK_KIND_ICON[b.kind]} size={20} color={theme.colors.secondary} />
                  <View style={styles.flex}>
                    <Text variant="titleSmall">{describeBlockFormat(b)}</Text>
                    <Text variant="bodySmall" style={muted}>
                      {(b.finishedAt && describeResult(b)) || 'Não registrado'}
                      {describeRounds(b) ? ` · ${describeRounds(b)}` : ''}
                    </Text>
                  </View>
                  {b.isPr && (
                    <Text
                      variant="labelSmall"
                      style={[styles.badge, { backgroundColor: theme.colors.tertiaryContainer, color: theme.colors.onTertiaryContainer }]}>
                      PR
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {session.notes ? (
        <Text variant="bodyMedium" style={muted}>
          “{session.notes}”
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button mode="contained" contentStyle={styles.mainBtn} onPress={close}>
          Concluir
        </Button>
        {session.workoutId && (
          <Button
            mode="contained-tonal"
            icon={routineUpdated ? 'check' : undefined}
            disabled={routineUpdated}
            contentStyle={styles.secondaryBtn}
            onPress={updateRoutine}>
            {routineUpdated ? 'Rotina atualizada' : 'Atualizar rotina com estes valores'}
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  extra,
  style,
  color,
}: {
  label: string;
  value: string;
  extra?: string;
  style: object;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, style]}>
      <Text variant="labelMedium" style={{ color: color ?? theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text variant="titleLarge" style={[styles.bold, styles.num, color ? { color } : null]}>
        {value}
        {extra ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {`  ${extra}`}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

function ExerciseRow({
  group,
  exerciseMap,
  machineMap,
}: {
  group: SessionSet[];
  exerciseMap: ReturnType<typeof useExerciseMap>;
  machineMap: ReturnType<typeof useMachineMap>;
}) {
  const theme = useTheme();
  const ex = exerciseMap.get(group[0].exerciseId);
  const machine = group[0].machineId ? machineMap.get(group[0].machineId) : undefined;
  const tool = machine?.name ?? (ex && ex.equipment !== 'none' ? equipmentText(ex) : null);
  const working = group.filter((s) => countsTowardStats(s.type));
  const best = bestSet(working.length ? working : group);
  const { volume } = summarizeSets(group);
  const muted = { color: theme.colors.onSurfaceVariant };
  return (
    <View style={styles.exRow}>
      <View style={styles.rowBetween}>
        <Text variant="titleSmall" style={styles.flex}>
          {ex?.name ?? '—'}
          {tool ? <Text style={muted}>{` (${tool})`}</Text> : null}
        </Text>
        <Text variant="bodySmall" style={muted}>
          {describeSetCounts(group.map((s) => s.type))}
        </Text>
      </View>
      <View style={styles.rowBetween}>
        <Text variant="bodySmall" style={[styles.flex, muted]}>
          {best ? `Melhor série: ${describeSet(best)}` : ''}
        </Text>
        {volume > 0 && (
          <Text variant="bodySmall" style={muted}>
            {formatVolume(volume)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  center: { textAlign: 'center' },
  num: { fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 16, flexGrow: 1 },
  header: { alignItems: 'center', gap: 8 },
  trophy: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1, borderRadius: 16, padding: 14, gap: 4 },
  section: { gap: 8 },
  record: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  list: { borderRadius: 16, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  exRow: { paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  actions: { gap: 10, marginTop: 'auto' },
  mainBtn: { height: 48 },
  secondaryBtn: { height: 44 },
});
