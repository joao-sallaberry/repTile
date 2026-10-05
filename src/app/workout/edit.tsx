import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, IconButton, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { DurationField } from '@/components/duration-field';
import { ExercisePicker } from '@/components/exercise-picker';
import { NumberField } from '@/components/number-field';
import { WORKOUT_TYPES, type Exercise, type WorkoutType } from '@/db/schema';
import { useExerciseMap } from '@/features/workouts/queries';
import {
  emptyItem,
  emptyWorkout,
  getWorkoutDraft,
  saveWorkout,
  type WorkoutDraft,
  type WorkoutItemDraft,
} from '@/features/workouts/repo';
import { WORKOUT_TYPE_LABEL } from '@/theme';

export default function EditWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [draft, setDraft] = useState<WorkoutDraft | null>(id ? null : emptyWorkout());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const exerciseMap = useExerciseMap();

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
        sets: type === 'strength' ? (it.sets ?? 3) : null,
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
                subtitle={ex?.category}
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
  return (
    <View style={styles.fields}>
      {strength && (
        <NumberField style={styles.field} label="Séries" value={item.sets} onChange={(sets) => onChange({ sets })} />
      )}
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
      {strength && (
        <DurationField
          style={styles.field}
          label="Descanso"
          value={item.restSec}
          onChange={(restSec) => onChange({ restSec })}
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
});
