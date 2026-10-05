import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, IconButton, List, ProgressBar, Switch, Text, TextInput, useTheme } from 'react-native-paper';

import { DurationField } from '@/components/duration-field';
import { NumberField } from '@/components/number-field';
import { db } from '@/db/client';
import { sessionSets, type Session } from '@/db/schema';
import type { TimerSpec } from '@/features/timer/engine';
import { startTimer } from '@/features/timer/start';
import { useTimerStore } from '@/features/timer/store';
import { useTimerSnapshot } from '@/features/timer/use-timer-snapshot';
import { describeItem, describeWorkoutFormat } from '@/features/workouts/describe';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatDuration } from '@/lib/format';

import { updateWodProgress, type SessionResult } from './repo';

const LEAD_IN_SEC = 10;

export function wodSpec(s: Session): TimerSpec {
  switch (s.type) {
    case 'amrap':
      return { kind: 'amrap', durationSec: s.durationSec ?? 600 };
    case 'emom':
      return { kind: 'emom', intervalSec: s.intervalSec ?? 60, rounds: s.rounds ?? 10 };
    default:
      return { kind: 'for_time', timeCapSec: s.timeCapSec };
  }
}

type Props = { session: Session; onSave: (result: SessionResult) => void };

export function WodSession({ session, onSave }: Props) {
  const active = useTimerStore((s) => s.active);
  const timer = active && active.sessionId === session.id && active.spec.kind !== 'rest' ? active : null;
  const snap = useTimerSnapshot(timer);
  const [finishedTimeSec, setFinishedTimeSec] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const start = () =>
    startTimer({ sessionId: session.id, label: session.name, spec: wodSpec(session), leadInSec: LEAD_IN_SEC });

  const finishForTime = () => {
    if (snap) setFinishedTimeSec(Math.round(snap.elapsedSec));
    useTimerStore.getState().pause();
    setShowResult(true);
  };

  const timerDone = snap?.phase === 'done';
  const resultVisible = showResult || timerDone;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {timer && snap && !resultVisible ? (
        <RunningTimer session={session} snap={snap} paused={timer.clock.pausedAt != null} onFinishForTime={finishForTime} />
      ) : !resultVisible ? (
        <Button mode="contained" icon="play" contentStyle={styles.bigBtn} labelStyle={styles.bigLabel} onPress={start}>
          Iniciar ({LEAD_IN_SEC}s para começar)
        </Button>
      ) : null}

      {resultVisible && (
        <ResultForm
          session={session}
          initialTimeSec={finishedTimeSec}
          timeCapped={timerDone && session.type === 'for_time'}
          onCancel={
            timerDone
              ? undefined
              : () => {
                  setShowResult(false);
                  useTimerStore.getState().resume();
                }
          }
          onSave={onSave}
        />
      )}

      <Movements session={session} />

      {!resultVisible && (
        <Button mode="text" onPress={() => setShowResult(true)}>
          Registrar resultado sem timer
        </Button>
      )}
    </ScrollView>
  );
}

function RunningTimer({
  session,
  snap,
  paused,
  onFinishForTime,
}: {
  session: Session;
  snap: NonNullable<ReturnType<typeof useTimerSnapshot>>;
  paused: boolean;
  onFinishForTime: () => void;
}) {
  useKeepAwake();
  const theme = useTheme();
  const store = useTimerStore.getState();
  const leadIn = snap.phase === 'lead_in';

  const phaseLabel = leadIn
    ? 'Prepare-se'
    : snap.round != null
      ? `Round ${snap.round} de ${snap.roundCount}`
      : session.type === 'amrap'
        ? 'Restante'
        : 'Tempo';

  return (
    <Card mode="contained" style={leadIn ? { backgroundColor: theme.colors.primaryContainer } : undefined}>
      <Card.Content style={styles.timerContent}>
        <Text variant="titleMedium">{paused ? 'Pausado' : phaseLabel}</Text>
        <Text style={[styles.timerText, { color: leadIn ? theme.colors.primary : theme.colors.onSurface }]}>
          {leadIn ? snap.displaySec : formatDuration(snap.displaySec)}
        </Text>
        {snap.totalSec != null && !leadIn && (
          <ProgressBar progress={snap.progress ?? 0} style={styles.progress} />
        )}
        {session.type === 'emom' && !leadIn && (
          <Text variant="bodyMedium">Total: {formatDuration(snap.elapsedSec)} / {formatDuration(snap.totalSec ?? 0)}</Text>
        )}
        {session.type === 'for_time' && session.timeCapSec != null && (
          <Text variant="bodyMedium">Time cap {formatDuration(session.timeCapSec)}</Text>
        )}
      </Card.Content>

      {session.type === 'amrap' && !leadIn && <RoundCounter session={session} />}

      <Card.Actions>
        <Button icon={paused ? 'play' : 'pause'} onPress={store.togglePause}>
          {paused ? 'Retomar' : 'Pausar'}
        </Button>
        {session.type === 'for_time' && !leadIn && (
          <Button mode="contained" icon="flag-checkered" onPress={onFinishForTime}>
            Terminei!
          </Button>
        )}
      </Card.Actions>
    </Card>
  );
}

/** AMRAP round counter, saved to the database on every tap. */
function RoundCounter({ session }: { session: Session }) {
  const rounds = session.resultRounds ?? 0;
  return (
    <View style={styles.counter}>
      <IconButton
        icon="minus"
        mode="outlined"
        disabled={rounds === 0}
        onPress={() => updateWodProgress(session.id, { resultRounds: rounds - 1 })}
      />
      <View style={styles.counterText}>
        <Text variant="displaySmall">{rounds}</Text>
        <Text variant="labelMedium">rounds</Text>
      </View>
      <Button
        mode="contained"
        icon="plus"
        contentStyle={styles.bigBtn}
        onPress={() => updateWodProgress(session.id, { resultRounds: rounds + 1 })}>
        Round
      </Button>
    </View>
  );
}

function ResultForm({
  session,
  initialTimeSec,
  timeCapped,
  onCancel,
  onSave,
}: {
  session: Session;
  initialTimeSec: number | null;
  timeCapped: boolean;
  onCancel?: () => void;
  onSave: (r: SessionResult) => void;
}) {
  const [timeSec, setTimeSec] = useState<number | null>(timeCapped ? null : initialTimeSec);
  const [rounds, setRounds] = useState<number | null>(
    session.type === 'emom' ? session.rounds : (session.resultRounds ?? null),
  );
  const [reps, setReps] = useState<number | null>(session.resultReps ?? null);
  const [rx, setRx] = useState(true);
  const [notes, setNotes] = useState('');

  const save = () =>
    onSave({
      resultTimeSec: session.type === 'for_time' ? timeSec : null,
      resultRounds: rounds,
      resultReps: session.type === 'emom' ? null : reps,
      rx,
      notes: notes.trim() || null,
    });

  return (
    <Card mode="contained">
      <Card.Title title={timeCapped ? 'Time cap! Registre até onde chegou' : 'Resultado'} />
      <Card.Content style={styles.form}>
        {session.type === 'for_time' && !timeCapped && (
          <DurationField label="Tempo final (m:ss)" value={timeSec} onChange={setTimeSec} />
        )}
        {(session.type === 'amrap' || timeCapped) && (
          <View style={styles.row}>
            <NumberField style={styles.flex} label="Rounds" value={rounds} onChange={setRounds} />
            <NumberField style={styles.flex} label="Reps extras" value={reps} onChange={setReps} />
          </View>
        )}
        {session.type === 'emom' && (
          <NumberField label="Rounds completos" value={rounds} onChange={setRounds} />
        )}
        <View style={styles.rxRow}>
          <Text variant="bodyLarge">Rx (sem adaptação)</Text>
          <Switch value={rx} onValueChange={setRx} />
        </View>
        <TextInput mode="outlined" label="Observações" multiline value={notes} onChangeText={setNotes} />
      </Card.Content>
      <Card.Actions>
        {onCancel && <Button onPress={onCancel}>Voltar ao timer</Button>}
        <Button mode="contained" onPress={save}>
          Salvar resultado
        </Button>
      </Card.Actions>
    </Card>
  );
}

function Movements({ session }: { session: Session }) {
  const exerciseMap = useExerciseMap();
  const { data: sets } = useLiveQuery(
    db
      .select()
      .from(sessionSets)
      .where(and(eq(sessionSets.sessionId, session.id), isNull(sessionSets.deletedAt)))
      .orderBy(asc(sessionSets.position)),
    [session.id],
  );
  return (
    <Card mode="outlined">
      <Card.Title title={describeWorkoutFormat(session)} />
      {sets.map((s, i) => (
        <View key={s.id}>
          {i > 0 && <Divider />}
          <List.Item
            title={exerciseMap.get(s.exerciseId)?.name ?? '—'}
            description={describeItem(s, session.type) || undefined}
          />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 12, gap: 12, paddingBottom: 48 },
  bigBtn: { height: 56 },
  bigLabel: { fontSize: 18 },
  timerContent: { alignItems: 'center', gap: 4, paddingVertical: 16 },
  timerText: { fontSize: 88, fontWeight: '700', fontVariant: ['tabular-nums'], lineHeight: 100 },
  progress: { width: 260, height: 8, borderRadius: 4 },
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 8 },
  counterText: { alignItems: 'center', minWidth: 64 },
  form: { gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  rxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
