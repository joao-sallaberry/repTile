import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Button, Dialog, IconButton, Portal, TextInput } from 'react-native-paper';

import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { deleteSession, finishSession, type SessionResult } from '@/features/session/repo';
import { StrengthSession } from '@/features/session/strength-session';
import { WodSession } from '@/features/session/wod-session';
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
  const elapsed = useElapsed(session?.startedAt ?? 0);

  if (!session) return null;

  const save = async (result: SessionResult) => {
    await finishSession(session.id, result);
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
      {session.type === 'strength' ? (
        <StrengthSession session={session} onFinish={() => setFinishOpen(true)} />
      ) : (
        <WodSession session={session} onSave={save} />
      )}
      <Portal>
        <Dialog visible={finishOpen} onDismiss={() => setFinishOpen(false)}>
          <Dialog.Title>Finalizar treino</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="Como foi? (opcional)" multiline value={notes} onChangeText={setNotes} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFinishOpen(false)}>Voltar</Button>
            <Button mode="contained" onPress={() => save({ notes: notes.trim() || null })}>
              Finalizar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
