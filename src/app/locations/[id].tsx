import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, List, Portal, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';

import { MachineThumb } from '@/components/machine-thumb';
import { db } from '@/db/client';
import { locationMachines, machines, type Exercise, type Location, type LocationKind } from '@/db/schema';
import { useCurrentLocation } from '@/features/places/current';
import { LOCATION_KIND_LABEL, useLocation } from '@/features/places/queries';
import {
  createMachine,
  deleteLocation,
  exercisesByMachine,
  linkMachineToLocation,
  locationsByMachine,
  updateLocation,
} from '@/features/places/repo';

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const location = useLocation(id);
  const currentId = useCurrentLocation((s) => s.id);
  const [name, setName] = useState<string | null>(null);
  const [adding, setAdding] = useState<'existing' | 'new' | null>(null);
  const [newName, setNewName] = useState('');
  const [extra, setExtra] = useState<{ exercises: Map<string, Exercise[]>; locations: Map<string, Location[]> }>({
    exercises: new Map(),
    locations: new Map(),
  });

  const { data: here, updatedAt } = useLiveQuery(
    db
      .select({ machine: machines })
      .from(locationMachines)
      .innerJoin(machines, eq(machines.id, locationMachines.machineId))
      .where(and(eq(locationMachines.locationId, id), isNull(locationMachines.deletedAt), isNull(machines.deletedAt)))
      .orderBy(asc(machines.name)),
    [id],
  );
  const { data: allMachines } = useLiveQuery(
    db.select().from(machines).where(isNull(machines.deletedAt)).orderBy(asc(machines.name)),
  );

  useEffect(() => {
    const ids = here.map((h) => h.machine.id);
    Promise.all([exercisesByMachine(ids), locationsByMachine(ids)]).then(([ex, loc]) =>
      setExtra({ exercises: ex, locations: loc }),
    );
  }, [here, updatedAt]);

  if (!location) return null;
  const hereIds = new Set(here.map((h) => h.machine.id));
  const linkable = allMachines.filter((m) => !hereIds.has(m.id));

  const confirmDelete = () =>
    Alert.alert('Excluir local?', 'As máquinas continuam existindo e o histórico é mantido.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (currentId === id) useCurrentLocation.getState().set(null);
          await deleteLocation(id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{ title: location.name, headerRight: () => <IconButton icon="delete-outline" onPress={confirmDelete} /> }}
      />
      <TextInput
        mode="outlined"
        label="Nome"
        value={name ?? location.name}
        onChangeText={setName}
        onBlur={() => name?.trim() && updateLocation(id, { name: name.trim() })}
      />
      <SegmentedButtons
        value={location.kind}
        onValueChange={(v) => updateLocation(id, { kind: v as LocationKind })}
        buttons={[
          { value: 'gym', label: LOCATION_KIND_LABEL.gym, icon: 'dumbbell' },
          { value: 'box', label: LOCATION_KIND_LABEL.box, icon: 'home-variant-outline' },
        ]}
      />
      <View style={styles.row}>
        <Text variant="bodyLarge" style={styles.flex}>
          Local atual
        </Text>
        <Switch
          value={currentId === id}
          onValueChange={(on) => useCurrentLocation.getState().set(on ? id : null)}
        />
      </View>

      <View>
        <Text variant="titleMedium">
          Máquinas <Text variant="bodySmall">· opcional</Text>
        </Text>
        <Text variant="bodySmall" style={styles.muted}>
          Entram aqui automaticamente quando você usa uma máquina num treino neste local.
        </Text>
      </View>
      {here.map(({ machine }) => {
        const others = (extra.locations.get(machine.id) ?? []).filter((l) => l.id !== id);
        const exs = extra.exercises.get(machine.id) ?? [];
        return (
          <List.Item
            key={machine.id}
            title={machine.name}
            description={[
              exs.length ? exs.map((e) => e.name).join(' · ') : 'Sem exercícios',
              others.length ? `Também em: ${others.map((l) => l.name).join(', ')}` : null,
            ]
              .filter(Boolean)
              .join('\n')}
            descriptionNumberOfLines={3}
            left={(p) => <MachineThumb photo={machine.photo} style={p.style} />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push({ pathname: '/machines/[id]', params: { id: machine.id } })}
          />
        );
      })}
      <View style={styles.row}>
        <Button icon="link-variant" mode="contained-tonal" style={styles.flex} disabled={!linkable.length} onPress={() => setAdding('existing')}>
          Associar existente
        </Button>
        <Button icon="plus" mode="outlined" style={styles.flex} onPress={() => setAdding('new')}>
          Nova máquina
        </Button>
      </View>

      <Portal>
        <Dialog visible={adding === 'existing'} onDismiss={() => setAdding(null)} style={styles.dialog}>
          <Dialog.Title>Associar máquina</Dialog.Title>
          <Dialog.ScrollArea style={styles.scroll}>
            <ScrollView>
              {linkable.map((m) => (
                <List.Item
                  key={m.id}
                  title={m.name}
                  onPress={async () => {
                    await linkMachineToLocation(m.id, id);
                    setAdding(null);
                  }}
                />
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setAdding(null)}>Fechar</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={adding === 'new'} onDismiss={() => setAdding(null)}>
          <Dialog.Title>Nova máquina</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="Nome" value={newName} onChangeText={setNewName} autoFocus />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAdding(null)}>Cancelar</Button>
            <Button
              mode="contained"
              disabled={!newName.trim()}
              onPress={async () => {
                await createMachine({ name: newName.trim(), locationId: id });
                setNewName('');
                setAdding(null);
              }}>
              Criar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muted: { opacity: 0.7 },
  dialog: { maxHeight: '80%' },
  scroll: { paddingHorizontal: 0, maxHeight: 400 },
});
