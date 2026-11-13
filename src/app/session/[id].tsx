import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Dialog, Icon, IconButton, Portal, Text, TextInput, useTheme } from 'react-native-paper';

import { SET_TYPE_COLORS } from '@/components/set-badge';
import { DateField, TimeField } from '@/components/time-field';

import { db } from '@/db/client';
import { sessionBlocks, sessions, sessionSets } from '@/db/schema';
import { plural } from '@/features/history/session-card';
import { formatMinutes } from '@/features/home/stats';
import { deleteSession, finishSession, saveSessionAsRoutine, type SessionResult } from '@/features/session/repo';
import { finishSummary } from '@/features/session/summary';
import { moveToDay, normalizeTimes } from '@/features/session/times';
import { SessionView } from '@/features/session/session-view';
import { useTimerStore } from '@/features/timer/store';
import { formatDuration } from '@/lib/format';

function useElapsed(since: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.floor((now - since) / 1000);
}

function stopTimerFor(sessionId: string) {
  const { active, stop } = useTimerStore.getState();
  if (active?.sessionId === sessionId) stop();
}

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: session } = useLiveQuery(db.query.sessions.findFirst({ where: eq(sessions.id, id) }), [id]);
  const [finishOpen, setFinishOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [saveRoutine, setSaveRoutine] = useState(false);
  const [name, setName] = useState('');
  const [times, setTimes] = useState({ start: 0, end: 0 });
  const elapsed = useElapsed(session?.startedAt ?? 0);
  const theme = useTheme();
  // Sets of the exercises blocks (WOD movements are marked by their block's result).
  const { data: plainSets } = useLiveQuery(
    db
      .select({ completedAt: sessionSets.completedAt, isPr: sessionSets.isPr, position: sessionSets.position })
      .from(sessionSets)
      .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionSets.sessionBlockId))
      .where(and(eq(sessionSets.sessionId, id), eq(sessionBlocks.kind, 'exercises'), isNull(sessionSets.deletedAt))),
    [id],
  );
  const summary = finishSummary(plainSets);

  if (!session) return null;

  const isFree = !session.workoutId;

  const save = async (result: SessionResult) => {
    await finishSession(session.id, result);
    if (isFree && saveRoutine && result.name) await saveSessionAsRoutine(session.id, result.name);
    stopTimerFor(session.id);
    router.replace({ pathname: '/summary/[id]', params: { id: session.id } });
  };

  const discard = () =>
    Alert.alert('Descartar treino?', 'Tudo o que foi registrado nesta sessão será apagado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: async () => {
          stopTimerFor(session.id);
          await deleteSession(session.id);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: `${session.name} · ${formatDuration(elapsed)}`,
          headerRight: () => <IconButton icon="delete-outline" onPress={discard} />,
        }}
      />
      <SessionView
        session={session}
        onFinish={() => {
          setTimes(normalizeTimes(session.startedAt, Date.now()));
          setName(session.name);
          setFinishOpen(true);
        }}
      />
      <Portal>
        <Dialog visible={finishOpen} onDismiss={() => setFinishOpen(false)}>
          <Dialog.Title>Finalizar treino</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="Nome do treino" value={name} onChangeText={setName} style={styles.name} />
            <DateField label="Data" value={times.start} onChange={(day) => setTimes((t) => moveToDay(t, day))} />
            <View style={styles.times}>
              <TimeField label="Início" value={times.start} onChange={(start) => setTimes((t) => normalizeTimes(start, t.end))} />
              <TimeField label="Término" value={times.end} onChange={(end) => setTimes((t) => normalizeTimes(t.start, end))} />
            </View>
            <View style={[styles.summary, { borderColor: theme.colors.outlineVariant }]}>
              <SummaryStat value={formatMinutes((times.end - times.start) / 1000)} label="duração" />
              {summary.total > 0 && <SummaryStat value={`${summary.done} de ${summary.total}`} label="séries feitas" />}
              {summary.prs > 0 && <SummaryStat value={plural(summary.prs, 'PR', 'PRs')} label="recordes" color={theme.colors.tertiary} />}
            </View>
            {summary.pending > 0 && (
              <View style={[styles.warning, { backgroundColor: SET_TYPE_COLORS.warmup.bg }]}>
                <Icon source="alert-outline" size={18} color={SET_TYPE_COLORS.warmup.fg} />
                <Text variant="bodySmall" style={[styles.flex, { color: SET_TYPE_COLORS.warmup.fg }]}>
                  {summary.pending === 1
                    ? '1 série não foi marcada e fica fora do registro.'
                    : `${summary.pending} séries não foram marcadas e ficam fora do registro.`}
                </Text>
              </View>
            )}
            <TextInput mode="outlined" label="Como foi? (opcional)" multiline value={notes} onChangeText={setNotes} />
            {isFree && (
              // The new routine takes the workout's name.
              <Checkbox.Item
                label="Salvar como rotina"
                status={saveRoutine ? 'checked' : 'unchecked'}
                onPress={() => setSaveRoutine((v) => !v)}
                style={styles.checkbox}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFinishOpen(false)}>Continuar treinando</Button>
            <Button
              mode="contained"
              disabled={!name.trim()}
              onPress={() =>
                save({ name: name.trim(), notes: notes.trim() || null, startedAt: times.start, finishedAt: times.end })
              }>
              Finalizar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

function SummaryStat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.flex}>
      <Text variant="titleMedium" style={[styles.number, color ? { color } : null]}>
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
  muted: { opacity: 0.7 },
  number: { fontVariant: ['tabular-nums'] },
  summary: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 12, marginBottom: 12 },
  name: { marginBottom: 12 },
  checkbox: { paddingHorizontal: 0 },
  times: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
