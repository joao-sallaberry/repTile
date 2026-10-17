import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, Snackbar, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { DurationField } from '@/components/duration-field';
import { ExercisePicker } from '@/components/exercise-picker';
import { LocationPicker } from '@/components/location-picker';
import { MachinePicker } from '@/components/machine-picker';
import { MachineThumb } from '@/components/machine-thumb';
import { NumberField } from '@/components/number-field';
import { SetBadge } from '@/components/set-badge';
import { SetTypeDialog } from '@/components/set-type-dialog';
import { db } from '@/db/client';
import { sessionSets, type Exercise, type Session, type SessionSet } from '@/db/schema';
import { useCurrentLocation } from '@/features/places/current';
import { useLocation, useMachineMap } from '@/features/places/queries';
import { startTimer } from '@/features/timer/start';
import { useTimerStore } from '@/features/timer/store';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatDuration, formatWeight } from '@/lib/format';

import { RestTimerBar } from './rest-timer-bar';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  previousSessionSets,
  removeExercise,
  removeSet,
  setExerciseMachine,
  setSessionLocation,
  setSetType,
  uncompleteSet,
  updateSet,
  type PerformedSetRow,
} from './repo';
import { countsTowardStats, pairPrevious, setLabels } from './sets';

type Props = { session: Session; onFinish: () => void };

export function StrengthSession({ session, onFinish }: Props) {
  const theme = useTheme();
  const exerciseMap = useExerciseMap();
  const location = useLocation(session.locationId);
  const [prMessage, setPrMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

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

  const done = sets.filter((s) => s.completedAt);
  const volume = done
    .filter((s) => countsTowardStats(s.type))
    .reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0);

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
      <View style={styles.stats}>
        <Stat label="Volume" value={`${Math.round(volume).toLocaleString('pt-BR')} kg`} />
        <Stat label="Séries" value={`${done.length} de ${sets.length}`} />
        <TouchableRipple
          style={[styles.location, { backgroundColor: theme.colors.elevation.level2 }]}
          borderless
          accessibilityRole="button"
          accessibilityLabel={`Local do treino: ${location?.name ?? 'sem local'}. Toque para trocar`}
          onPress={() => setLocationOpen(true)}>
          <View style={styles.locationInner}>
            <IconButton icon="map-marker-outline" size={18} iconColor={theme.colors.primary} style={styles.noMargin} />
            <Text variant="labelLarge" numberOfLines={1} style={styles.flex}>
              {location?.name ?? 'Escolher local'}
            </Text>
          </View>
        </TouchableRipple>
      </View>

      <RestTimerBar sessionId={session.id} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {groups.length === 0 && (
          <Card mode="outlined">
            <Card.Content style={styles.empty}>
              <Text variant="titleMedium">Treino livre</Text>
              <Text variant="bodyMedium" style={styles.muted}>
                Adicione os exercícios conforme for fazendo. No fim, dá para salvar como rotina.
              </Text>
            </Card.Content>
          </Card>
        )}
        {groups.map(({ position, sets: groupSets }) => (
          <ExerciseCard
            key={position}
            exercise={exerciseMap.get(groupSets[0].exerciseId)}
            sets={groupSets}
            session={session}
            locationName={location?.name}
            onToggle={onToggle}
          />
        ))}
        <Button icon="plus" mode="contained" onPress={() => setPickerOpen(true)} contentStyle={styles.bigBtn}>
          Adicionar exercício
        </Button>
      </ScrollView>
      <View style={styles.footer}>
        <Button mode="contained" icon="flag-checkered" onPress={onFinish} contentStyle={styles.bigBtn} style={styles.flex}>
          Finalizar treino
        </Button>
      </View>

      <ExercisePicker
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        onPick={(exerciseId) => addExerciseToSession(session.id, exerciseId)}
      />
      <LocationPicker
        visible={locationOpen}
        currentId={session.locationId}
        onDismiss={() => setLocationOpen(false)}
        onPick={(id) => {
          setSessionLocation(session.id, id);
          useCurrentLocation.getState().set(id);
        }}
      />
      <Snackbar visible={!!prMessage} onDismiss={() => setPrMessage(null)} duration={4000}>
        {prMessage}
      </Snackbar>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="labelSmall" style={styles.muted}>
        {label}
      </Text>
      <Text variant="titleMedium" style={styles.num}>
        {value}
      </Text>
    </View>
  );
}

function prevText(p: PerformedSetRow | null): string {
  if (!p) return '—';
  if (p.weight) return `${formatWeight(p.weight)} × ${p.reps ?? 0}`;
  return p.reps != null ? `${p.reps} reps` : '—';
}

function ExerciseCard({
  exercise,
  sets,
  session,
  locationName,
  onToggle,
}: {
  exercise: Exercise | undefined;
  sets: SessionSet[];
  session: Session;
  locationName?: string;
  onToggle: (s: SessionSet) => void;
}) {
  const theme = useTheme();
  const machineMap = useMachineMap();
  const [previous, setPrevious] = useState<PerformedSetRow[]>([]);
  const [machineOpen, setMachineOpen] = useState(false);
  const [typeFor, setTypeFor] = useState<SessionSet | null>(null);
  const { exerciseId, machineId, position, restSec } = sets[0];
  const machine = machineId ? machineMap.get(machineId) : undefined;
  const measure = exercise?.measure ?? 'weight_reps';

  useEffect(() => {
    previousSessionSets(exerciseId, machineId, session.id).then(setPrevious);
  }, [exerciseId, machineId, session.id]);

  const labels = setLabels(sets.map((s) => s.type));
  const paired = pairPrevious(sets, previous);
  const typeIndex = typeFor ? sets.findIndex((s) => s.id === typeFor.id) : -1;

  const confirmRemove = () => {
    const done = sets.filter((s) => s.completedAt).length;
    Alert.alert(
      `Remover ${exercise?.name ?? 'exercício'}?`,
      done === 1
        ? 'A série já feita dele neste treino também será apagada. A rotina não muda.'
        : done > 1
          ? `As ${done} séries já feitas dele neste treino também serão apagadas. A rotina não muda.`
          : 'Ele sai só deste treino; a rotina não muda.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => removeExercise(session.id, position),
        },
      ],
    );
  };

  return (
    <Card mode="contained">
      <View style={styles.cardHeader}>
        <View style={styles.flex}>
          <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
            {exercise?.name ?? 'Exercício'}
          </Text>
          <TouchableRipple
            onPress={() => setMachineOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={machine ? `Máquina: ${machine.name}. Toque para trocar` : 'Associar uma máquina'}
            style={styles.machineChip}>
            <View style={styles.row}>
              {machine?.photo ? (
                <MachineThumb photo={machine.photo} size={28} style={styles.machineThumb} />
              ) : (
                <IconButton icon="cog-outline" size={14} style={styles.noMargin} />
              )}
              <Text variant="bodySmall" style={styles.muted}>
                {machine?.name ?? 'Sem máquina · escolher'}
              </Text>
            </View>
          </TouchableRipple>
        </View>
        {restSec ? (
          <Text variant="labelMedium" style={[styles.restChip, { backgroundColor: theme.colors.secondaryContainer }]}>
            ⏱ {formatDuration(restSec)}
          </Text>
        ) : null}
        <IconButton
          icon="delete-outline"
          size={20}
          accessibilityLabel={`Remover ${exercise?.name ?? 'exercício'} do treino`}
          onPress={confirmRemove}
          style={styles.noMargin}
        />
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.th, styles.colBadge]}>SÉRIE</Text>
        <Text style={[styles.th, styles.colPrev]}>ANTERIOR</Text>
        <Text style={[styles.th, styles.colInput]}>{measure === 'weight_reps' ? 'KG' : ''}</Text>
        <Text style={[styles.th, styles.colInput]}>{headerFor(measure)}</Text>
        <Text style={[styles.th, styles.colCheck]}>✓</Text>
      </View>

      {sets.map((s, i) => (
        <SetRow
          key={s.id}
          set={s}
          label={labels[i]}
          previous={prevText(paired[i])}
          measure={measure}
          onToggle={() => onToggle(s)}
          onBadge={() => setTypeFor(s)}
        />
      ))}

      <View style={styles.addRow}>
        <Button icon="plus" mode="contained-tonal" style={styles.flex} onPress={() => addSet(session.id, position)}>
          Série
        </Button>
        <Button
          icon="plus"
          mode="text"
          textColor="#F5C451"
          onPress={() => addSet(session.id, position, 'warmup')}>
          Aquecimento
        </Button>
      </View>

      <MachinePicker
        visible={machineOpen}
        exerciseId={exerciseId}
        exerciseName={exercise?.name ?? ''}
        locationId={session.locationId}
        locationName={locationName}
        currentMachineId={machineId}
        onDismiss={() => setMachineOpen(false)}
        onPick={(id) => setExerciseMachine(session.id, position, exerciseId, id)}
      />
      {typeFor && (
        <SetTypeDialog
          visible
          current={typeFor.type}
          subtitle={`${exercise?.name ?? ''} · série ${typeIndex + 1}`}
          onDismiss={() => setTypeFor(null)}
          onPick={(t) => setSetType(typeFor.id, t)}
          onRemove={sets.length > 1 ? () => removeSet(typeFor.id) : undefined}
        />
      )}
    </Card>
  );
}

function headerFor(measure: Exercise['measure']) {
  switch (measure) {
    case 'time':
      return 'TEMPO';
    case 'distance':
      return 'METROS';
    case 'calories':
      return 'CAL';
    default:
      return 'REPS';
  }
}

function SetRow({
  set,
  label,
  previous,
  measure,
  onToggle,
  onBadge,
}: {
  set: SessionSet;
  label: string;
  previous: string;
  measure: Exercise['measure'];
  onToggle: () => void;
  onBadge: () => void;
}) {
  const theme = useTheme();
  const done = !!set.completedAt;
  const doneBg = '#16301F';

  return (
    <View style={[styles.setRow, done && { backgroundColor: doneBg }]}>
      <View style={styles.colBadge}>
        <SetBadge type={set.type} label={label} onPress={onBadge} />
      </View>
      <Text variant="bodySmall" numberOfLines={1} style={[styles.colPrev, styles.muted]}>
        {previous}
      </Text>
      <View style={styles.colInput}>
        {measure === 'weight_reps' && (
          <NumberField
            label=""
            accessibilityLabel={`Série ${label}, peso em kg`}
            decimal
            value={set.weight ?? 0}
            onChange={(weight) => updateSet(set.id, { weight })}
            style={styles.input}
          />
        )}
      </View>
      <View style={styles.colInput}>
        {measure === 'time' ? (
          <DurationField
            label=""
            accessibilityLabel={`Série ${label}, tempo`}
            value={set.durationSec}
            onChange={(durationSec) => updateSet(set.id, { durationSec })}
            style={styles.input}
          />
        ) : measure === 'distance' ? (
          <NumberField
            label=""
            accessibilityLabel={`Série ${label}, distância em metros`}
            decimal
            value={set.distanceM}
            onChange={(distanceM) => updateSet(set.id, { distanceM })}
            style={styles.input}
          />
        ) : measure === 'calories' ? (
          <NumberField
            label=""
            accessibilityLabel={`Série ${label}, calorias`}
            value={set.calories}
            onChange={(calories) => updateSet(set.id, { calories })}
            style={styles.input}
          />
        ) : (
          <NumberField
            label=""
            accessibilityLabel={`Série ${label}, repetições`}
            value={set.reps}
            onChange={(reps) => updateSet(set.id, { reps })}
            style={styles.input}
          />
        )}
      </View>
      <View style={styles.colCheck}>
        <IconButton
          icon="check"
          mode="contained"
          size={20}
          containerColor={done ? theme.colors.tertiary : theme.colors.surfaceVariant}
          iconColor={done ? theme.colors.onTertiary : theme.colors.onSurfaceVariant}
          accessibilityLabel={done ? `Série ${label} concluída` : `Concluir série ${label}`}
          onPress={onToggle}
          style={styles.noMargin}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { gap: 4 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  noMargin: { margin: 0 },
  muted: { opacity: 0.7 },
  num: { fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  location: { flex: 1, borderRadius: 12, minHeight: 44, justifyContent: 'center' },
  locationInner: { flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  content: { padding: 12, gap: 12, paddingBottom: 32 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingTop: 12, gap: 8 },
  machineThumb: { margin: 4, marginRight: 6 },
  machineChip: { alignSelf: 'flex-start', borderRadius: 8, minHeight: 32, justifyContent: 'center', marginLeft: -6 },
  restChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden', marginTop: 2 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  th: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, opacity: 0.7, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 3, gap: 6 },
  colBadge: { width: 44, alignItems: 'center' },
  colPrev: { flex: 1, textAlign: 'left' },
  colInput: { width: 68 },
  colCheck: { width: 44, alignItems: 'center' },
  input: { textAlign: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingTop: 6 },
  bigBtn: { height: 48 },
  footer: { flexDirection: 'row', padding: 16, paddingTop: 8 },
});
