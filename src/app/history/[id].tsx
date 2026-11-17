import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Dialog, Divider, Icon, IconButton, Menu, Portal, Text, TextInput, TouchableRipple, useTheme } from 'react-native-paper';

import { ExerciseThumb } from '@/components/exercise-media';
import { SetBadge } from '@/components/set-badge';
import { DateField, TimeField } from '@/components/time-field';
import { db } from '@/db/client';
import { sessionBlocks, sessions, sessionSets, workouts, type SessionBlock, type SessionSet } from '@/db/schema';
import { plural } from '@/features/history/session-card';
import { HealthCard, healthStats } from '@/features/health/health-card';
import { HealthLinkDialog } from '@/features/health/link-dialog';
import { useSessionHealth } from '@/features/health/use-session-health';
import { useRoutineSessions } from '@/features/home/queries';
import { formatMinutes, formatVolume, summarizeSets } from '@/features/home/stats';
import { useLocation, useMachineMap } from '@/features/places/queries';
import { beginRoutine } from '@/features/session/begin';
import { deleteSession, editSessionDetails } from '@/features/session/repo';
import { countsTowardStats, setLabels } from '@/features/session/sets';
import { describeSet, loadSessionRecords, type SessionRecord } from '@/features/session/summary';
import { moveToDay, normalizeTimes } from '@/features/session/times';
import { BLOCK_KIND_ICON, describeBlockFormat, isWod } from '@/features/workouts/blocks';
import { describeItem, describeResult } from '@/features/workouts/describe';
import { defaultEquipment, equipmentLabel } from '@/features/workouts/equipment';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatDuration } from '@/lib/format';

const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "+5% vs. anterior", "−3% vs. anterior" or "igual à anterior". */
function volumeChange(volume: number, previous: number | undefined): string | null {
  if (!previous || !volume) return null;
  const pct = Math.round(((volume - previous) / previous) * 100);
  if (pct === 0) return 'igual à anterior';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% vs. anterior`;
}

/** Time of each round (AMRAP / For Time splits) or reps per round (Tabata). */
function roundPills(b: SessionBlock): string[] {
  if ((b.kind === 'amrap' || b.kind === 'for_time') && b.roundSplits?.length) {
    return b.roundSplits.map((at, i) => `R${i + 1} ${formatDuration(at - (i ? b.roundSplits![i - 1] : 0))}`);
  }
  if (b.kind === 'tabata' && b.roundReps?.length) return b.roundReps.map((n, i) => `R${i + 1} ${n}`);
  return [];
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const exerciseMap = useExerciseMap();
  const machineMap = useMachineMap();
  const [menuOpen, setMenuOpen] = useState(false);
  /** The ⋮ › Editar dialog's draft: name, date and times; null while closed. */
  const [edit, setEdit] = useState<{ name: string; start: number; end: number } | null>(null);
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [healthOpen, setHealthOpen] = useState(false);

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
  const workoutId = session?.workoutId ?? '';
  const { data: routine } = useLiveQuery(
    db.query.workouts.findFirst({ where: and(eq(workouts.id, workoutId), isNull(workouts.deletedAt)) }),
    [workoutId],
  );
  const runs = useRoutineSessions(workoutId);
  const location = useLocation(session?.locationId);
  const health = useSessionHealth(id, session?.finishedAt != null);

  const plainBlockIds = useMemo(() => new Set(blocks.filter((b) => b.kind === 'exercises').map((b) => b.id)), [blocks]);
  const plainSets = useMemo(
    () => sets.filter((s) => s.sessionBlockId && plainBlockIds.has(s.sessionBlockId)),
    [sets, plainBlockIds],
  );
  const donePlainSets = useMemo(() => plainSets.filter((s) => s.completedAt), [plainSets]);

  useEffect(() => {
    if (sets.length || blocks.length) void loadSessionRecords(id, donePlainSets, blocks).then(setRecords);
  }, [id, donePlainSets, blocks, sets.length]);

  if (!session) return null;

  const { volume, sets: workSets } = summarizeSets(donePlainSets);
  const warmups = donePlainSets.filter((s) => s.type === 'warmup').length;
  const end = session.finishedAt ?? session.startedAt;
  const span = `${timeFmt.format(session.startedAt)} – ${timeFmt.format(end)}`;
  const previous = runs.find((r) => r.startedAt < session.startedAt);
  const recordNames = records.map((r) => (r.kind === 'wod' ? r.title : (exerciseMap.get(r.exerciseId)?.name ?? '—')));

  const stats = [
    { label: 'Duração', value: formatMinutes((end - session.startedAt) / 1000), note: span },
    ...(plainSets.length
      ? [
          { label: 'Volume', value: formatVolume(volume), note: volumeChange(volume, previous?.volume) },
          { label: 'Séries', value: String(workSets), note: warmups ? `+ ${plural(warmups, 'aquecimento', 'aquecimentos')}` : null },
        ]
      : []),
    { label: 'Recordes', value: records.length ? String(records.length) : '—', note: recordNames.slice(0, 2).join(', ') || null, pr: records.length > 0 },
    ...healthStats(health),
  ];

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

  const prColors = { backgroundColor: theme.colors.tertiaryContainer, color: theme.colors.onTertiaryContainer };
  const muted = { color: theme.colors.onSurfaceVariant };
  const openExercise = (exerciseId: string) => router.push({ pathname: '/exercise/[id]', params: { id: exerciseId } });

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Menu
              visible={menuOpen}
              onDismiss={() => setMenuOpen(false)}
              anchor={<IconButton icon="dots-vertical" accessibilityLabel="Mais opções" onPress={() => setMenuOpen(true)} />}>
              <Menu.Item
                leadingIcon="clock-edit-outline"
                title="Editar nome, data e horários"
                onPress={() => {
                  setMenuOpen(false);
                  setEdit({ name: session.name, ...normalizeTimes(session.startedAt, end) });
                }}
              />
              <Menu.Item
                leadingIcon="heart-pulse"
                title="Dados do Google Health"
                onPress={() => {
                  setMenuOpen(false);
                  setHealthOpen(true);
                }}
              />
              <Menu.Item
                leadingIcon="delete"
                title="Excluir do histórico"
                onPress={() => {
                  setMenuOpen(false);
                  confirmDelete();
                }}
              />
            </Menu>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text variant="labelLarge" style={[styles.date, { color: theme.colors.primary }]}>
            {dayFmt.format(session.startedAt).toUpperCase()}
          </Text>
          <Text variant="headlineSmall" style={styles.bold}>
            {session.name}
          </Text>
          <View style={styles.subtitle}>
            <Text variant="bodyMedium" style={muted}>
              {span}
            </Text>
            {routine && (
              <Text
                variant="bodyMedium"
                style={[styles.link, { color: theme.colors.primary }]}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: routine.id } })}>
                · Rotina {routine.name}
              </Text>
            )}
          </View>
          {location && (
            <View style={styles.chips}>
              <Chip
                icon="map-marker-outline"
                style={{ backgroundColor: theme.colors.secondaryContainer }}
                textStyle={{ color: theme.colors.onSecondaryContainer }}>
                {location.name}
              </Chip>
            </View>
          )}
        </View>

        <View style={styles.stats}>
          {stats.map((st) => (
            <View key={st.label} style={[styles.stat, { backgroundColor: theme.colors.elevation.level1 }]}>
              <Text variant="bodySmall" style={muted}>
                {st.label}
              </Text>
              <Text
                variant="headlineSmall"
                style={[styles.bold, 'pr' in st && st.pr ? { color: theme.colors.onTertiaryContainer } : null]}>
                {st.value}
              </Text>
              {st.note ? (
                <Text variant="bodySmall" style={muted} numberOfLines={1}>
                  {st.note}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        {health && <HealthCard health={health} />}

        {session.notes ? (
          <View style={[styles.notes, { backgroundColor: theme.colors.elevation.level1 }]}>
            <Icon source="comment-outline" size={20} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodyMedium" style={styles.flex}>
              {session.notes}
            </Text>
          </View>
        ) : null}

        {records.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.heading}>
              Novos recordes
            </Text>
            <Card mode="outlined" style={[styles.clip, { borderColor: theme.colors.tertiaryContainer }]}>
              {records.map((r, i) => (
                <View key={r.key}>
                  {i > 0 && <Divider />}
                  <View style={styles.recordRow}>
                    <View style={[styles.recordIcon, { backgroundColor: theme.colors.tertiaryContainer }]}>
                      <Icon
                        source={r.kind === 'wod' ? 'flag-checkered' : r.what === 'maior carga' ? 'trophy-outline' : 'trending-up'}
                        size={18}
                        color={theme.colors.onTertiaryContainer}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Text variant="titleSmall">{r.kind === 'wod' ? r.title : `${recordNames[i]} · ${r.what}`}</Text>
                      <Text variant="bodySmall" style={muted}>
                        {r.detail}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}

        {plainSets.length > 0 && (
          <Text variant="titleMedium" style={[styles.heading, styles.section]}>
            Exercícios
          </Text>
        )}
        {blocks.map((block) => {
          const blockSets = sets.filter((s) => s.sessionBlockId === block.id);
          if (isWod(block.kind)) return <WodCard key={block.id} block={block} movements={blockSets} />;
          const groups = new Map<number, SessionSet[]>();
          for (const s of blockSets) groups.set(s.position, [...(groups.get(s.position) ?? []), s]);
          return [...groups.values()].map((list) => {
            const first = list[0];
            const ex = exerciseMap.get(first.exerciseId);
            const machine = first.machineId ? machineMap.get(first.machineId) : undefined;
            const tool = machine
              ? machine.name
              : ex && ex.equipment.length > 1
                ? equipmentLabel(first.equipment ?? defaultEquipment(ex))
                : null;
            const labels = setLabels(list.map((s) => s.type));
            const exVolume = list.reduce(
              (acc, s) => acc + (s.completedAt && countsTowardStats(s.type) ? (s.weight ?? 0) * (s.reps ?? 0) : 0),
              0,
            );
            return (
              <Card key={first.id} mode="contained" style={styles.clip}>
                <TouchableRipple onPress={() => openExercise(first.exerciseId)} accessibilityRole="button">
                  <View style={styles.exerciseHeader}>
                    <ExerciseThumb exerciseId={first.exerciseId} equipment={first.equipment} size={44} />
                    <View style={styles.flex}>
                      <Text variant="titleSmall">{ex?.name ?? '—'}</Text>
                      {tool && (
                        <Text variant="bodySmall" style={muted} numberOfLines={1}>
                          {tool}
                        </Text>
                      )}
                    </View>
                    {exVolume > 0 && (
                      <Text variant="bodyMedium" style={muted}>
                        {formatVolume(exVolume)}
                      </Text>
                    )}
                    <Icon source="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                  </View>
                </TouchableRipple>
                {list.map((s, i) => (
                  <View key={s.id}>
                    <Divider />
                    <View style={[styles.setRow, !s.completedAt && styles.skipped]}>
                      <SetBadge type={s.type} label={labels[i]} />
                      <Text variant="bodyLarge" style={styles.flex}>
                        {s.weight || s.reps ? describeSet(s) : describeItem(s, 'amrap') || '—'}
                      </Text>
                      {s.isPr && (
                        <Text variant="labelSmall" style={[styles.badge, prColors]}>
                          PR
                        </Text>
                      )}
                      {!s.completedAt && (
                        <Text variant="bodySmall" style={muted}>
                          não feita
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            );
          });
        })}

        {routine && (
          <Button mode="outlined" icon="play" contentStyle={styles.again} style={styles.section} onPress={() => beginRoutine(routine.id)}>
            Fazer de novo
          </Button>
        )}
      </ScrollView>

      <HealthLinkDialog session={session} health={health} visible={healthOpen} onDismiss={() => setHealthOpen(false)} />
      <Portal>
        <Dialog visible={edit != null} onDismiss={() => setEdit(null)}>
          <Dialog.Title>Editar treino</Dialog.Title>
          {edit && (
            <Dialog.Content style={styles.editForm}>
              <TextInput mode="outlined" label="Nome do treino" value={edit.name} onChangeText={(name) => setEdit({ ...edit, name })} />
              <DateField label="Data" value={edit.start} onChange={(day) => setEdit({ ...edit, ...moveToDay(edit, day) })} />
              <View style={styles.times}>
                <TimeField
                  label="Início"
                  value={edit.start}
                  onChange={(start) => setEdit({ ...edit, ...normalizeTimes(start, edit.end) })}
                />
                <TimeField label="Término" value={edit.end} onChange={(e) => setEdit({ ...edit, ...normalizeTimes(edit.start, e) })} />
              </View>
            </Dialog.Content>
          )}
          <Dialog.Actions>
            <Button onPress={() => setEdit(null)}>Cancelar</Button>
            <Button
              mode="contained"
              disabled={!edit?.name.trim()}
              onPress={async () => {
                if (edit) await editSessionDetails(session.id, { name: edit.name.trim(), startedAt: edit.start, finishedAt: edit.end });
                setEdit(null);
              }}>
              Salvar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

/** A WOD block as done: format, RX/Scaled, result with PR, the round splits and the movements. */
function WodCard({ block, movements }: { block: SessionBlock; movements: SessionSet[] }) {
  const theme = useTheme();
  const exerciseMap = useExerciseMap();
  const result = block.finishedAt ? describeResult({ ...block, rx: true })?.replace(/ · Rx$/, '') : null;
  const pills = roundPills(block);
  return (
    <Card mode="outlined" style={[styles.clip, { borderColor: theme.colors.secondaryContainer }]}>
      <View style={styles.wodHeader}>
        <View style={[styles.wodIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
          <Icon source={BLOCK_KIND_ICON[block.kind]} size={20} color={theme.colors.onSecondaryContainer} />
        </View>
        <Text variant="titleMedium" style={styles.flex}>
          {describeBlockFormat(block)}
        </Text>
        {block.finishedAt && (
          <Text variant="labelSmall" style={[styles.badge, { backgroundColor: theme.colors.elevation.level3 }]}>
            {block.rx ? 'RX' : 'SCALED'}
          </Text>
        )}
      </View>
      <View style={styles.wodBody}>
        <View style={styles.wodResult}>
          <Text variant="headlineMedium" style={styles.bold}>
            {result ?? 'Não registrado'}
          </Text>
          {block.isPr && (
            <Text
              variant="labelSmall"
              style={[styles.badge, { backgroundColor: theme.colors.tertiaryContainer, color: theme.colors.onTertiaryContainer }]}>
              PR
            </Text>
          )}
        </View>
        {pills.length > 0 && (
          <View style={styles.pills} accessibilityLabel="Cada round">
            {pills.map((p) => (
              <Text key={p} variant="bodySmall" style={[styles.pill, { backgroundColor: theme.colors.elevation.level2 }]}>
                {p}
              </Text>
            ))}
          </View>
        )}
      </View>
      {movements.map((s, i) => (
        <View key={s.id}>
          <Divider />
          <View style={styles.movementRow}>
            <Text variant="bodyLarge" style={styles.flex}>
              {block.alternate ? `${i + 1}. ` : ''}
              {exerciseMap.get(s.exerciseId)?.name ?? '—'}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {describeItem(s, block.kind)}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bold: { fontWeight: '700' },
  content: { padding: 12, gap: 12, paddingBottom: 48 },
  hero: { gap: 4, paddingHorizontal: 8 },
  date: { letterSpacing: 0.6, fontWeight: '700' },
  subtitle: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  link: { fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexBasis: '48%', flexGrow: 1, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
  notes: { flexDirection: 'row', gap: 12, borderRadius: 18, padding: 14 },
  section: { marginTop: 8 },
  heading: { paddingHorizontal: 4 },
  clip: { overflow: 'hidden' },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  recordIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 14 },
  skipped: { opacity: 0.5 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  wodHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 6 },
  wodIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  wodBody: { paddingLeft: 66, paddingRight: 14, paddingBottom: 12, gap: 8 },
  wodResult: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  movementRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 },
  again: { height: 52 },
  times: { flexDirection: 'row', gap: 8, marginTop: 8 },
  editForm: { gap: 8 },
});
