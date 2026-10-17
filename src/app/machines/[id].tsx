import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Checkbox, Chip, IconButton, List, Text, TextInput } from 'react-native-paper';

import { ExercisePicker } from '@/components/exercise-picker';
import { db } from '@/db/client';
import { locationMachines, machineExercises, machines } from '@/db/schema';
import { LOCATION_KIND_LABEL, useLocations } from '@/features/places/queries';
import {
  deleteMachine,
  linkMachineToExercise,
  linkMachineToLocation,
  unlinkMachineFromExercise,
  unlinkMachineFromLocation,
  updateMachine,
} from '@/features/places/repo';
import { performedSets } from '@/features/session/repo';
import { countsTowardStats } from '@/features/session/sets';
import { computePRs } from '@/features/stats/prs';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatWeight } from '@/lib/format';

export default function MachineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseMap = useExerciseMap();
  const allLocations = useLocations();
  const [name, setName] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [records, setRecords] = useState<Map<string, string>>(new Map());

  const { data: machine } = useLiveQuery(db.query.machines.findFirst({ where: eq(machines.id, id) }), [id]);
  const { data: exLinks } = useLiveQuery(
    db
      .select()
      .from(machineExercises)
      .where(and(eq(machineExercises.machineId, id), isNull(machineExercises.deletedAt))),
    [id],
  );
  const { data: locLinks } = useLiveQuery(
    db
      .select()
      .from(locationMachines)
      .where(and(eq(locationMachines.machineId, id), isNull(locationMachines.deletedAt))),
    [id],
  );

  useEffect(() => {
    Promise.all(
      exLinks.map(async (l) => {
        const sets = (await performedSets(l.exerciseId, { machineId: id })).filter((s) => countsTowardStats(s.type));
        const best = computePRs(sets).maxWeight;
        return [l.exerciseId, best ? `${formatWeight(best.value)} × ${best.reps}` : 'Ainda sem séries'] as const;
      }),
    ).then((entries) => setRecords(new Map(entries)));
  }, [exLinks, id]);

  if (!machine) return null;
  const linkedLocations = new Set(locLinks.map((l) => l.locationId));

  const confirmDelete = () =>
    Alert.alert('Excluir máquina?', 'As séries já registradas continuam no histórico.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteMachine(id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{ title: machine.name, headerRight: () => <IconButton icon="delete-outline" onPress={confirmDelete} /> }}
      />
      <TextInput
        mode="outlined"
        label="Nome"
        value={name ?? machine.name}
        onChangeText={setName}
        onBlur={() => name?.trim() && updateMachine(id, name.trim())}
      />

      <Text variant="titleMedium">Exercícios</Text>
      <View style={styles.chips}>
        {exLinks.map((l) => (
          <Chip key={l.id} onClose={() => unlinkMachineFromExercise(id, l.exerciseId)}>
            {exerciseMap.get(l.exerciseId)?.name ?? '—'}
          </Chip>
        ))}
        <Chip icon="plus" mode="outlined" onPress={() => setPickerOpen(true)}>
          Exercício
        </Chip>
      </View>

      <View>
        <Text variant="titleMedium">Locais</Text>
        <Text variant="bodySmall" style={styles.muted}>
          A mesma máquina pode estar em vários lugares. O histórico de carga é um só para todos eles.
        </Text>
      </View>
      <Card mode="contained">
        {allLocations.map((loc) => (
          <Checkbox.Item
            key={loc.id}
            label={`${loc.name}\n${LOCATION_KIND_LABEL[loc.kind]}`}
            status={linkedLocations.has(loc.id) ? 'checked' : 'unchecked'}
            onPress={() =>
              linkedLocations.has(loc.id) ? unlinkMachineFromLocation(id, loc.id) : linkMachineToLocation(id, loc.id)
            }
          />
        ))}
        {allLocations.length === 0 && (
          <Card.Content>
            <Text variant="bodyMedium">Nenhum local cadastrado.</Text>
          </Card.Content>
        )}
      </Card>

      {exLinks.length > 0 && (
        <>
          <Text variant="titleMedium">Recordes nesta máquina</Text>
          <Card mode="outlined">
            {exLinks.map((l) => (
              <List.Item
                key={l.id}
                title={exerciseMap.get(l.exerciseId)?.name ?? '—'}
                right={() => <Text variant="bodyMedium">{records.get(l.exerciseId) ?? ''}</Text>}
                onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: l.exerciseId } })}
                style={styles.recordItem}
              />
            ))}
          </Card>
        </>
      )}

      <Button mode="text" onPress={() => router.push('/locations')}>
        Ver locais
      </Button>
      <ExercisePicker
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        onPick={(exerciseId) => linkMachineToExercise(id, exerciseId)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muted: { opacity: 0.7 },
  recordItem: { paddingRight: 16 },
});
