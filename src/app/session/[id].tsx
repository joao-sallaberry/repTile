import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';

import { TimeField } from '@/components/time-field';

import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { deleteSession, finishSession, saveSessionAsRoutine, type SessionResult } from '@/features/session/repo';
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

const DAY_MS = 24 * 3600 * 1000;

/** Keeps the end after the start and within a day of it (a picked time keeps its original day). */
function normalizeTimes(start: number, end: number) {
  while (end <= start) end += DAY_MS;
  while (end - start > DAY_MS) end -= DAY_MS;
  return { start, end };
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
  const [routineName, setRoutineName] = useState('');
  const [times, setTimes] = useState({ start: 0, end: 0 });
  const elapsed = useElapsed(session?.startedAt ?? 0);

  if (!session) return null;

  const isFree = !session.workoutId;

  const save = async (result: SessionResult) => {
    await finishSession(session.id, result);
    if (isFree && saveRoutine && routineName.trim()) await saveSessionAsRoutine(session.id, routineName.trim());
    stopTimerFor(session.id);
    router.replace({ pathname: '/history/[id]', params: { id: session.id } });
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
          setFinishOpen(true);
        }}
      />
      <Portal>
        <Dialog visible={finishOpen} onDismiss={() => setFinishOpen(false)}>
          <Dialog.Title>Finalizar treino</Dialog.Title>
          <Dialog.Content>
            <View style={styles.times}>
              <TimeField label="Início" value={times.start} onChange={(start) => setTimes((t) => normalizeTimes(start, t.end))} />
              <TimeField label="Término" value={times.end} onChange={(end) => setTimes((t) => normalizeTimes(t.start, end))} />
            </View>
            <Text variant="bodySmall" style={styles.duration}>
              Duração: {formatDuration((times.end - times.start) / 1000)}
            </Text>
            <TextInput mode="outlined" label="Como foi? (opcional)" multiline value={notes} onChangeText={setNotes} />
            {isFree && (
              <>
                <Checkbox.Item
                  label="Salvar como rotina"
                  status={saveRoutine ? 'checked' : 'unchecked'}
                  onPress={() => setSaveRoutine((v) => !v)}
                  style={styles.checkbox}
                />
                {saveRoutine && (
                  <TextInput mode="outlined" label="Nome da rotina" value={routineName} onChangeText={setRoutineName} />
                )}
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFinishOpen(false)}>Voltar</Button>
            <Button
              mode="contained"
              disabled={isFree && saveRoutine && !routineName.trim()}
              onPress={() => save({ notes: notes.trim() || null, startedAt: times.start, finishedAt: times.end })}>
              Finalizar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  checkbox: { paddingHorizontal: 0 },
  times: { flexDirection: 'row', gap: 8 },
  duration: { opacity: 0.7, marginTop: 6, marginBottom: 12 },
});
