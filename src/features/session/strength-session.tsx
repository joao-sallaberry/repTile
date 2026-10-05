import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, Snackbar, Text, useTheme } from 'react-native-paper';

import { ExercisePicker } from '@/components/exercise-picker';
import { NumberField } from '@/components/number-field';
import { DurationField } from '@/components/duration-field';
import { db } from '@/db/client';
import { sessionSets, type Exercise, type Session, type SessionSet } from '@/db/schema';
import { startTimer } from '@/features/timer/start';
import { useTimerStore } from '@/features/timer/store';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatWeight } from '@/lib/format';

import { RestTimerBar } from './rest-timer-bar';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  performedSets,
  removeSet,
  uncompleteSet,
  updateSet,
} from './repo';

type Props = { session: Session; onFinish: () => void };

export function StrengthSession({ session, onFinish }: Props) {
  const exerciseMap = useExerciseMap();
  const [prMessage, setPrMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: sets } = useLiveQuery(
    db
      .select()
      .from(sessionSets)
      .where(and(eq(sessionSets.sessionId, session.id), isNull(sessionSets.deletedAt)))
      .orderBy(asc(sessionSets.position), asc(sessionSets.setIndex)),
    [session.id],
  );

  const groups = useMemo(() => {
    const map = new Map<number, SessionSet[]>();
    for (const s of sets) map.set(s.position, [...(map.get(s.position) ?? []), s]);
    return [...map.entries()].map(([position, list]) => ({ position, sets: list }));
  }, [sets]);

  const done = sets.filter((s) => s.completedAt).length;

  const onToggle = async (set: SessionSet) => {
    if (set.completedAt) {
      await uncompleteSet(set.id);
      return;
    }
    const ex = exerciseMap.get(set.exerciseId);
    const isPR = await completeSet(set);
    if (isPR) setPrMessage(`Novo PR em ${ex?.name ?? 'exercício'}: ${formatWeight(set.weight)} × ${set.reps} 🏆`);

    const remaining = sets.filter((s) => !s.completedAt && s.id !== set.id).length;
    if (set.restSec && remaining > 0) {
      startTimer({
        sessionId: session.id,
        label: `Descanso · ${ex?.name ?? ''}`,
        spec: { kind: 'rest', durationSec: set.restSec },
      });
    } else if (remaining === 0) {
      useTimerStore.getState().stop();
    }
  };

  return (
    <View style={styles.flex}>
      <RestTimerBar sessionId={session.id} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {groups.map(({ position, sets: groupSets }) => (
          <ExerciseCard
            key={position}
            exercise={exerciseMap.get(groupSets[0].exerciseId)}
            sets={groupSets}
            sessionId={session.id}
            onToggle={onToggle}
            onAddSet={() => addSet(session.id, position)}
          />
        ))}
        <Button icon="plus" mode="outlined" onPress={() => setPickerOpen(true)}>
          Adicionar exercício
        </Button>
      </ScrollView>
      <View style={styles.footer}>
        <Text variant="labelLarge">
          {done}/{sets.length} séries
        </Text>
        <Button mode="contained" icon="flag-checkered" onPress={onFinish}>
          Finalizar treino
        </Button>
      </View>

      <ExercisePicker
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        onPick={(exerciseId) => addExerciseToSession(session.id, exerciseId)}
      />
      <Snackbar visible={!!prMessage} onDismiss={() => setPrMessage(null)} duration={4000}>
        {prMessage}
      </Snackbar>
    </View>
  );
}

function ExerciseCard({
  exercise,
  sets,
  sessionId,
  onToggle,
  onAddSet,
}: {
  exercise: Exercise | undefined;
  sets: SessionSet[];
  sessionId: string;
  onToggle: (s: SessionSet) => void;
  onAddSet: () => void;
}) {
  const [lastTime, setLastTime] = useState<string | null>(null);
  const exerciseId = sets[0].exerciseId;

  useEffect(() => {
    performedSets(exerciseId, sessionId).then((prev) => {
      const last = prev.at(-1);
      if (!last) return setLastTime(null);
      const lastSession = prev.filter((p) => p.sessionId === last.sessionId);
      setLastTime(
        lastSession.map((p) => (p.weight ? `${formatWeight(p.weight)} × ${p.reps}` : `${p.reps} reps`)).join(', '),
      );
    });
  }, [exerciseId, sessionId]);

  const allDone = sets.every((s) => s.completedAt);
  return (
    <Card mode={allDone ? 'outlined' : 'contained'}>
      <Card.Title
        title={exercise?.name ?? 'Exercício'}
        subtitle={lastTime ? `Última vez: ${lastTime}` : exercise?.category}
        subtitleNumberOfLines={2}
      />
      <Card.Content style={styles.sets}>
        {sets.map((s, i) => (
          <SetRow key={s.id} set={s} index={i} measure={exercise?.measure ?? 'weight_reps'} onToggle={() => onToggle(s)} />
        ))}
      </Card.Content>
      <Card.Actions>
        <Button icon="plus" onPress={onAddSet}>
          Série
        </Button>
      </Card.Actions>
    </Card>
  );
}

function SetRow({
  set,
  index,
  measure,
  onToggle,
}: {
  set: SessionSet;
  index: number;
  measure: Exercise['measure'];
  onToggle: () => void;
}) {
  const theme = useTheme();
  const done = !!set.completedAt;
  const confirmRemove = () =>
    Alert.alert(`Remover série ${index + 1}?`, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removeSet(set.id) },
    ]);

  return (
    <View style={[styles.setRow, done && { backgroundColor: theme.colors.tertiaryContainer }]}>
      <Text variant="titleMedium" style={styles.setIndex} onLongPress={confirmRemove}>
        {index + 1}
      </Text>
      {measure === 'weight_reps' && (
        <>
          <IconButton icon="minus" size={18} onPress={() => updateSet(set.id, { weight: Math.max(0, (set.weight ?? 0) - 2.5) })} />
          <NumberField
            style={styles.input}
            label="kg"
            decimal
            value={set.weight}
            onChange={(weight) => updateSet(set.id, { weight })}
          />
          <IconButton icon="plus" size={18} onPress={() => updateSet(set.id, { weight: (set.weight ?? 0) + 2.5 })} />
        </>
      )}
      {(measure === 'weight_reps' || measure === 'reps') && (
        <NumberField style={styles.input} label="reps" value={set.reps} onChange={(reps) => updateSet(set.id, { reps })} />
      )}
      {measure === 'time' && (
        <DurationField
          style={styles.input}
          label="tempo"
          value={set.durationSec}
          onChange={(durationSec) => updateSet(set.id, { durationSec })}
        />
      )}
      {measure === 'distance' && (
        <NumberField
          style={styles.input}
          label="m"
          decimal
          value={set.distanceM}
          onChange={(distanceM) => updateSet(set.id, { distanceM })}
        />
      )}
      {measure === 'calories' && (
        <NumberField style={styles.input} label="cal" value={set.calories} onChange={(calories) => updateSet(set.id, { calories })} />
      )}
      <IconButton
        icon={done ? 'check-circle' : 'check-circle-outline'}
        iconColor={done ? theme.colors.tertiary : undefined}
        size={32}
        onPress={onToggle}
        onLongPress={confirmRemove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 12, gap: 12, paddingBottom: 32 },
  sets: { gap: 4 },
  setRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingLeft: 8 },
  setIndex: { width: 20, textAlign: 'center' },
  input: { flex: 1, marginHorizontal: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
});
