import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, IconButton, List, ProgressBar, Switch, Text, useTheme } from 'react-native-paper';

import { DurationField } from '@/components/duration-field';
import { NumberField } from '@/components/number-field';
import { db } from '@/db/client';
import { sessionSets, type SessionBlock, type SessionSet } from '@/db/schema';
import { startTimer } from '@/features/timer/start';
import { useTimerStore } from '@/features/timer/store';
import { useTimerSnapshot } from '@/features/timer/use-timer-snapshot';
import { blockTimerSpec, describeBlockFormat, emomMovementIndex } from '@/features/workouts/blocks';
import { describeItem } from '@/features/workouts/describe';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatDuration } from '@/lib/format';

import { updateWodProgress, type BlockResult } from './repo';

const LEAD_IN_SEC = 10;

type Snap = NonNullable<ReturnType<typeof useTimerSnapshot>>;

/** Runs one WOD block of a session: lead-in, timer, round counter and result. */
export function WodRunner({ block, onSave }: { block: SessionBlock; onSave: (result: BlockResult) => void }) {
  const active = useTimerStore((s) => s.active);
  const timer = active && active.blockId === block.id ? active : null;
  const snap = useTimerSnapshot(timer);
  const [finishedTimeSec, setFinishedTimeSec] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const movements = useMovements(block.id);
  const format = describeBlockFormat(block) ?? '';

  const start = () =>
    startTimer({ sessionId: block.sessionId, blockId: block.id, label: format, spec: blockTimerSpec(block), leadInSec: LEAD_IN_SEC });

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
        <RunningTimer block={block} snap={snap} paused={timer.clock.pausedAt != null} movements={movements} onFinishForTime={finishForTime} />
      ) : !resultVisible ? (
        <Button mode="contained" icon="play" contentStyle={styles.bigBtn} labelStyle={styles.bigLabel} onPress={start}>
          Iniciar ({LEAD_IN_SEC}s para começar)
        </Button>
      ) : null}

      {resultVisible && (
        <ResultForm
          block={block}
          initialTimeSec={finishedTimeSec}
          timeCapped={timerDone && block.kind === 'for_time'}
          onCancel={
            timerDone
              ? undefined
              : () => {
                  setShowResult(false);
                  useTimerStore.getState().resume();
                }
          }
          onSave={(r) => {
            useTimerStore.getState().stop();
            onSave(r);
          }}
        />
      )}

      <Movements block={block} movements={movements} />

      {!resultVisible && (
        <Button mode="text" onPress={() => setShowResult(true)}>
          Registrar resultado sem timer
        </Button>
      )}
    </ScrollView>
  );
}

function useMovements(blockId: string) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(sessionSets)
      .where(and(eq(sessionSets.sessionBlockId, blockId), isNull(sessionSets.deletedAt)))
      .orderBy(asc(sessionSets.position)),
    [blockId],
  );
  return data;
}

function RunningTimer({
  block,
  snap,
  paused,
  movements,
  onFinishForTime,
}: {
  block: SessionBlock;
  snap: Snap;
  paused: boolean;
  movements: SessionSet[];
  onFinishForTime: () => void;
}) {
  useKeepAwake();
  const theme = useTheme();
  const exerciseMap = useExerciseMap();
  const store = useTimerStore.getState();
  const leadIn = snap.phase === 'lead_in';

  // Alternating EMOM: the movement of the current interval (the first one during the lead-in).
  const idx = emomMovementIndex(leadIn ? 1 : (snap.round ?? 1), movements.length, block.alternate);
  const current = idx != null ? movements[idx] : undefined;
  const next = idx != null && movements.length > 1 ? movements[(idx + 1) % movements.length] : undefined;
  const label = (m: SessionSet) => `${exerciseMap.get(m.exerciseId)?.name ?? '—'} · ${describeItem(m, block.kind)}`;

  const phaseLabel = leadIn
    ? 'Prepare-se'
    : snap.round != null
      ? `Intervalo ${snap.round} de ${snap.roundCount}`
      : block.kind === 'amrap'
        ? 'Restante'
        : 'Tempo';

  return (
    <Card mode="contained" style={leadIn ? { backgroundColor: theme.colors.primaryContainer } : undefined}>
      <Card.Content style={styles.timerContent}>
        <Text variant="titleMedium">{paused ? 'Pausado' : phaseLabel}</Text>
        <Text style={[styles.timerText, { color: leadIn ? theme.colors.primary : theme.colors.onSurface }]}>
          {leadIn ? snap.displaySec : formatDuration(snap.displaySec)}
        </Text>
        {snap.totalSec != null && !leadIn && <ProgressBar progress={snap.progress ?? 0} style={styles.progress} />}
        {current && (
          <View style={styles.now}>
            <Text variant="labelMedium" style={styles.muted}>
              {leadIn ? 'PRIMEIRO' : 'AGORA'}
            </Text>
            <Text variant="headlineSmall" style={styles.center}>
              {label(current)}
            </Text>
            {next && (
              <Text variant="bodyMedium" style={styles.muted}>
                Depois: {label(next)}
              </Text>
            )}
          </View>
        )}
        {block.kind === 'emom' && !leadIn && (
          <Text variant="bodyMedium">
            Total: {formatDuration(snap.elapsedSec)} / {formatDuration(snap.totalSec ?? 0)}
          </Text>
        )}
        {block.kind === 'for_time' && block.timeCapSec != null && (
          <Text variant="bodyMedium">Time cap {formatDuration(block.timeCapSec)}</Text>
        )}
      </Card.Content>

      {block.kind === 'amrap' && !leadIn && <RoundCounter block={block} />}

      <Card.Actions>
        <Button icon={paused ? 'play' : 'pause'} onPress={store.togglePause}>
          {paused ? 'Retomar' : 'Pausar'}
        </Button>
        {block.kind === 'for_time' && !leadIn && (
          <Button mode="contained" icon="flag-checkered" onPress={onFinishForTime}>
            Terminei!
          </Button>
        )}
      </Card.Actions>
    </Card>
  );
}

/** AMRAP round counter, saved to the database on every tap. */
function RoundCounter({ block }: { block: SessionBlock }) {
  const rounds = block.resultRounds ?? 0;
  return (
    <View style={styles.counter}>
      <IconButton
        icon="minus"
        mode="outlined"
        disabled={rounds === 0}
        onPress={() => updateWodProgress(block.id, { resultRounds: rounds - 1 })}
      />
      <View style={styles.counterText}>
        <Text variant="displaySmall">{rounds}</Text>
        <Text variant="labelMedium">rounds</Text>
      </View>
      <Button mode="contained" icon="plus" contentStyle={styles.bigBtn} onPress={() => updateWodProgress(block.id, { resultRounds: rounds + 1 })}>
        Round
      </Button>
    </View>
  );
}

function ResultForm({
  block,
  initialTimeSec,
  timeCapped,
  onCancel,
  onSave,
}: {
  block: SessionBlock;
  initialTimeSec: number | null;
  timeCapped: boolean;
  onCancel?: () => void;
  onSave: (r: BlockResult) => void;
}) {
  const [timeSec, setTimeSec] = useState<number | null>(timeCapped ? null : initialTimeSec);
  const [rounds, setRounds] = useState<number | null>(block.kind === 'emom' ? block.rounds : (block.resultRounds ?? null));
  const [reps, setReps] = useState<number | null>(block.resultReps ?? null);
  const [rx, setRx] = useState(true);

  const save = () =>
    onSave({
      resultTimeSec: block.kind === 'for_time' ? timeSec : null,
      resultRounds: rounds,
      resultReps: block.kind === 'emom' ? null : reps,
      rx,
    });

  return (
    <Card mode="contained">
      <Card.Title title={timeCapped ? 'Time cap! Registre até onde chegou' : 'Resultado'} />
      <Card.Content style={styles.form}>
        {block.kind === 'for_time' && !timeCapped && (
          <DurationField label="Tempo final (m:ss)" value={timeSec} onChange={setTimeSec} />
        )}
        {(block.kind === 'amrap' || timeCapped) && (
          <View style={styles.row}>
            <NumberField style={styles.flex} label="Rounds" value={rounds} onChange={setRounds} />
            <NumberField style={styles.flex} label="Reps extras" value={reps} onChange={setReps} />
          </View>
        )}
        {block.kind === 'emom' && <NumberField label="Intervalos completos" value={rounds} onChange={setRounds} />}
        <View style={styles.rxRow}>
          <Text variant="bodyLarge">Rx (sem adaptação)</Text>
          <Switch value={rx} onValueChange={setRx} />
        </View>
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

function Movements({ block, movements }: { block: SessionBlock; movements: SessionSet[] }) {
  const exerciseMap = useExerciseMap();
  return (
    <Card mode="outlined">
      <Card.Title title={describeBlockFormat(block)} subtitle={block.alternate ? 'Um movimento por intervalo, em sequência' : undefined} />
      {movements.map((s, i) => (
        <View key={s.id}>
          {i > 0 && <Divider />}
          <List.Item
            title={`${block.alternate ? `${i + 1}. ` : ''}${exerciseMap.get(s.exerciseId)?.name ?? '—'}`}
            description={describeItem(s, block.kind) || undefined}
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
  now: { alignItems: 'center', gap: 2, marginTop: 12 },
  center: { textAlign: 'center' },
  muted: { opacity: 0.7 },
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 8 },
  counterText: { alignItems: 'center', minWidth: 64 },
  form: { gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  rxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
