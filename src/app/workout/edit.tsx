import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  HelperText,
  IconButton,
  List,
  SegmentedButtons,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import { DurationField } from '@/components/duration-field';
import { ExercisePicker } from '@/components/exercise-picker';
import { LocationPicker } from '@/components/location-picker';
import { MachinePicker } from '@/components/machine-picker';
import { NumberField } from '@/components/number-field';
import { SetBadge } from '@/components/set-badge';
import { SetTypeDialog } from '@/components/set-type-dialog';
import { WORKOUT_TYPES, type Exercise, type SetType, type WorkoutType } from '@/db/schema';
import { useLocation, useMachineMap } from '@/features/places/queries';
import { setLabels } from '@/features/session/sets';
import { useExerciseMap } from '@/features/workouts/queries';
import {
  emptyItem,
  emptyWorkout,
  getWorkoutDraft,
  newSet,
  saveWorkout,
  type SetDraft,
  type WorkoutDraft,
  type WorkoutItemDraft,
} from '@/features/workouts/repo';
import { WORKOUT_TYPE_LABEL } from '@/theme';

export default function EditWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [draft, setDraft] = useState<WorkoutDraft | null>(id ? null : emptyWorkout());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [machineFor, setMachineFor] = useState<number | null>(null);
  const exerciseMap = useExerciseMap();
  const machineMap = useMachineMap();
  const location = useLocation(draft?.locationId);
  const theme = useTheme();

  useEffect(() => {
    if (id) getWorkoutDraft(id).then(setDraft);
  }, [id]);

  if (!draft) return null;

  const update = (patch: Partial<WorkoutDraft>) => setDraft({ ...draft, ...patch });
  const updateItem = (index: number, patch: Partial<WorkoutItemDraft>) =>
    update({ items: draft.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  const moveItem = (index: number, delta: number) => {
    const items = [...draft.items];
    const [it] = items.splice(index, 1);
    items.splice(index + delta, 0, it);
    update({ items });
  };

  const changeType = (type: WorkoutType) => {
    const defaults = emptyWorkout(type);
    update({
      type,
      durationSec: draft.durationSec ?? defaults.durationSec,
      intervalSec: draft.intervalSec ?? defaults.intervalSec,
      rounds: draft.rounds ?? defaults.rounds,
      timeCapSec: draft.timeCapSec ?? defaults.timeCapSec,
      items: draft.items.map((it) => ({
        ...it,
        sets: type === 'strength' ? (it.sets.length ? it.sets : [1, 2, 3].map(() => newSet('normal', it))) : [],
        restSec: type === 'strength' ? (it.restSec ?? 90) : null,
      })),
    });
  };

  const errors = validate(draft);
  const save = async () => {
    setSaving(true);
    try {
      const savedId = await saveWorkout(id ?? null, cleanDraft(draft));
      if (id) router.back();
      else router.replace({ pathname: '/workout/[id]', params: { id: savedId } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <Stack.Screen
        options={{
          title: id ? 'Editar treino' : 'Novo treino',
          headerRight: () => (
            <Button mode="contained" onPress={save} disabled={errors.length > 0 || saving} loading={saving}>
              Salvar
            </Button>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput mode="outlined" label="Nome do treino" value={draft.name} onChangeText={(name) => update({ name })} />

        <SegmentedButtons
          value={draft.type}
          onValueChange={(v) => changeType(v as WorkoutType)}
          density="small"
          buttons={WORKOUT_TYPES.map((t) => ({ value: t, label: WORKOUT_TYPE_LABEL[t] }))}
        />

        <TouchableRipple
          onPress={() => setLocationOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Local da rotina: ${location?.name ?? 'nenhum'}. Toque para trocar`}
          style={[styles.locationBtn, { backgroundColor: theme.colors.elevation.level2 }]}>
          <List.Item
            title={location?.name ?? 'Sem local fixo'}
            description={location ? 'Local da rotina' : 'Usa o local atual ao iniciar'}
            left={(p) => <List.Icon {...p} icon="map-marker-outline" color={theme.colors.primary} />}
            right={(p) => <List.Icon {...p} icon="chevron-down" />}
          />
        </TouchableRipple>

        <TypeParams draft={draft} update={update} />

        <TextInput
          mode="outlined"
          label="Observações"
          multiline
          value={draft.notes ?? ''}
          onChangeText={(notes) => update({ notes: notes || null })}
        />

        <Text variant="titleMedium" style={styles.section}>
          {draft.type === 'strength' ? 'Exercícios' : 'Movimentos (por round)'}
        </Text>

        {draft.items.map((item, index) => {
          const ex = exerciseMap.get(item.exerciseId);
          return (
            <Card key={item.id ?? `new-${index}`} mode="contained">
              <Card.Title
                title={ex?.name ?? 'Exercício removido'}
                subtitle={item.machineId ? `⚙ ${machineMap.get(item.machineId)?.name ?? ''}` : ex?.category}
                right={() => (
                  <View style={styles.row}>
                    <IconButton icon="arrow-up" disabled={index === 0} onPress={() => moveItem(index, -1)} />
                    <IconButton
                      icon="arrow-down"
                      disabled={index === draft.items.length - 1}
                      onPress={() => moveItem(index, 1)}
                    />
                    <IconButton
                      icon="delete-outline"
                      onPress={() => update({ items: draft.items.filter((_, i) => i !== index) })}
                    />
                  </View>
                )}
              />
              <Card.Content>
                <Button
                  compact
                  icon="cog-outline"
                  mode="text"
                  style={styles.machineBtn}
                  onPress={() => setMachineFor(index)}>
                  {item.machineId ? 'Trocar máquina' : 'Sem máquina · adicionar'}
                </Button>
                <ItemFields
                  type={draft.type}
                  exercise={ex}
                  item={item}
                  onChange={(patch) => updateItem(index, patch)}
                />
              </Card.Content>
            </Card>
          );
        })}

        <Button icon="plus" mode="outlined" onPress={() => setPickerOpen(true)}>
          Adicionar exercício
        </Button>
        {errors.map((e) => (
          <HelperText key={e} type="info">
            {e}
          </HelperText>
        ))}
      </ScrollView>

      <ExercisePicker
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        onPick={(exerciseId) => update({ items: [...draft.items, emptyItem(exerciseId, draft.type)] })}
      />
      <LocationPicker
        visible={locationOpen}
        currentId={draft.locationId}
        noneLabel="Sem local fixo"
        onDismiss={() => setLocationOpen(false)}
        onPick={(locationId) => update({ locationId })}
      />
      {machineFor != null && draft.items[machineFor] && (
        <MachinePicker
          visible
          exerciseId={draft.items[machineFor].exerciseId}
          exerciseName={exerciseMap.get(draft.items[machineFor].exerciseId)?.name ?? ''}
          locationId={draft.locationId}
          locationName={location?.name}
          currentMachineId={draft.items[machineFor].machineId}
          onDismiss={() => setMachineFor(null)}
          onPick={(machineId) => updateItem(machineFor, { machineId })}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function TypeParams({ draft, update }: { draft: WorkoutDraft; update: (p: Partial<WorkoutDraft>) => void }) {
  switch (draft.type) {
    case 'strength':
      return null;
    case 'amrap':
      return (
        <DurationField
          label="Duração (m:ss)"
          value={draft.durationSec}
          onChange={(durationSec) => update({ durationSec })}
        />
      );
    case 'emom':
      return (
        <View style={styles.row}>
          <DurationField
            style={styles.flex}
            label="Intervalo (m:ss)"
            value={draft.intervalSec}
            onChange={(intervalSec) => update({ intervalSec })}
          />
          <NumberField style={styles.flex} label="Rounds" value={draft.rounds} onChange={(rounds) => update({ rounds })} />
        </View>
      );
    case 'for_time':
      return (
        <View style={styles.row}>
          <NumberField style={styles.flex} label="Rounds" value={draft.rounds} onChange={(rounds) => update({ rounds })} />
          <DurationField
            style={styles.flex}
            label="Time cap (m:ss)"
            value={draft.timeCapSec}
            onChange={(timeCapSec) => update({ timeCapSec })}
          />
        </View>
      );
  }
}

function ItemFields({
  type,
  exercise,
  item,
  onChange,
}: {
  type: WorkoutType;
  exercise: Exercise | undefined;
  item: WorkoutItemDraft;
  onChange: (patch: Partial<WorkoutItemDraft>) => void;
}) {
  const measure = exercise?.measure ?? 'reps';
  const strength = type === 'strength';
  if (strength) {
    return (
      <View style={styles.setsBox}>
        <SetsEditor measure={measure} sets={item.sets} onChange={(sets) => onChange({ sets })} />
        <DurationField
          label="Descanso entre séries"
          value={item.restSec}
          onChange={(restSec) => onChange({ restSec })}
        />
      </View>
    );
  }
  return (
    <View style={styles.fields}>
      {(measure === 'weight_reps' || measure === 'reps') && (
        <NumberField style={styles.field} label="Reps" value={item.reps} onChange={(reps) => onChange({ reps })} />
      )}
      {measure === 'weight_reps' && (
        <NumberField
          style={styles.field}
          label="Carga (kg)"
          decimal
          value={item.weight}
          onChange={(weight) => onChange({ weight })}
        />
      )}
      {measure === 'time' && (
        <DurationField
          style={styles.field}
          label="Tempo"
          value={item.durationSec}
          onChange={(durationSec) => onChange({ durationSec })}
        />
      )}
      {measure === 'distance' && (
        <NumberField
          style={styles.field}
          label="Distância (m)"
          decimal
          value={item.distanceM}
          onChange={(distanceM) => onChange({ distanceM })}
        />
      )}
      {measure === 'calories' && (
        <NumberField style={styles.field} label="Calorias" value={item.calories} onChange={(calories) => onChange({ calories })} />
      )}
    </View>
  );
}

/** Strength: one row per set with its own type, weight and reps. */
function SetsEditor({
  measure,
  sets,
  onChange,
}: {
  measure: Exercise['measure'];
  sets: SetDraft[];
  onChange: (sets: SetDraft[]) => void;
}) {
  const [typeFor, setTypeFor] = useState<number | null>(null);
  const labels = setLabels(sets.map((st) => st.type));
  const patch = (i: number, p: Partial<SetDraft>) => onChange(sets.map((st, j) => (j === i ? { ...st, ...p } : st)));
  const add = (type: SetType) => {
    const sameType = sets.filter((st) => st.type === type);
    const from = sameType.at(-1) ?? sets.at(-1);
    const s = newSet(type, from);
    // warm-ups go right after the existing warm-ups
    const at = type === 'warmup' ? sameType.length && sets.lastIndexOf(sameType.at(-1)!) + 1 : sets.length;
    onChange([...sets.slice(0, at), s, ...sets.slice(at)]);
  };
  const amount = measure === 'time' ? 'Tempo' : measure === 'distance' ? 'Metros' : measure === 'calories' ? 'Cal' : 'Reps';

  return (
    <View style={styles.setsBox}>
      <View style={styles.setRow}>
        <Text style={[styles.th, styles.colBadge]}>SÉRIE</Text>
        <Text style={[styles.th, styles.flex]}>{measure === 'weight_reps' ? 'KG' : ''}</Text>
        <Text style={[styles.th, styles.flex]}>{amount.toUpperCase()}</Text>
        <View style={styles.colRemove} />
      </View>
      {sets.map((st, i) => (
        <View key={st.id ?? `n-${i}`} style={styles.setRow}>
          <View style={styles.colBadge}>
            <SetBadge type={st.type} label={labels[i]} onPress={() => setTypeFor(i)} />
          </View>
          <View style={styles.flex}>
            {measure === 'weight_reps' && (
              <NumberField
                label=""
                accessibilityLabel={`Série ${labels[i]}, meta de carga em kg`}
                decimal
                value={st.weight ?? 0}
                onChange={(weight) => patch(i, { weight })}
              />
            )}
          </View>
          <View style={styles.flex}>
            {measure === 'time' ? (
              <DurationField label="" value={st.durationSec} onChange={(durationSec) => patch(i, { durationSec })} />
            ) : measure === 'distance' ? (
              <NumberField label="" decimal value={st.distanceM} onChange={(distanceM) => patch(i, { distanceM })} />
            ) : measure === 'calories' ? (
              <NumberField label="" value={st.calories} onChange={(calories) => patch(i, { calories })} />
            ) : (
              <NumberField
                label=""
                accessibilityLabel={`Série ${labels[i]}, meta de repetições`}
                value={st.reps}
                onChange={(reps) => patch(i, { reps })}
              />
            )}
          </View>
          <IconButton
            icon="close"
            size={18}
            style={styles.colRemove}
            disabled={sets.length <= 1}
            accessibilityLabel={`Remover série ${labels[i]}`}
            onPress={() => onChange(sets.filter((_, j) => j !== i))}
          />
        </View>
      ))}
      <View style={styles.row}>
        <Button icon="plus" mode="contained-tonal" style={styles.flex} textColor="#F5C451" onPress={() => add('warmup')}>
          Aquecimento
        </Button>
        <Button icon="plus" mode="contained-tonal" style={styles.flex} onPress={() => add('normal')}>
          Série normal
        </Button>
      </View>
      {typeFor != null && sets[typeFor] && (
        <SetTypeDialog
          visible
          current={sets[typeFor].type}
          onDismiss={() => setTypeFor(null)}
          onPick={(type) => patch(typeFor, { type })}
          onRemove={sets.length > 1 ? () => onChange(sets.filter((_, j) => j !== typeFor)) : undefined}
        />
      )}
    </View>
  );
}

function validate(d: WorkoutDraft): string[] {
  const errors: string[] = [];
  if (!d.name.trim()) errors.push('Dê um nome ao treino.');
  if (d.items.length === 0) errors.push('Adicione pelo menos um exercício.');
  if (d.type === 'amrap' && !d.durationSec) errors.push('Informe a duração do AMRAP.');
  if (d.type === 'emom' && (!d.intervalSec || !d.rounds)) errors.push('Informe intervalo e rounds do EMOM.');
  return errors;
}

/** Drops fields that don't apply to the selected type. */
function cleanDraft(d: WorkoutDraft): WorkoutDraft {
  return {
    ...d,
    name: d.name.trim(),
    durationSec: d.type === 'amrap' ? d.durationSec : null,
    intervalSec: d.type === 'emom' ? d.intervalSec : null,
    rounds: d.type === 'emom' || d.type === 'for_time' ? d.rounds : null,
    timeCapSec: d.type === 'for_time' ? d.timeCapSec : null,
  };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  section: { marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { flexGrow: 1, flexBasis: 90 },
  locationBtn: { borderRadius: 12 },
  machineBtn: { alignSelf: 'flex-start', marginLeft: -8, marginBottom: 4 },
  setsBox: { gap: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  th: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, opacity: 0.7, textAlign: 'center' },
  colBadge: { width: 44, alignItems: 'center' },
  colRemove: { width: 36, margin: 0 },
});
