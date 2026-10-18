import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Divider, IconButton, List, Portal, Text, TextInput } from 'react-native-paper';

import { MachineThumb } from '@/components/machine-thumb';
import {
  createMachine,
  linkMachineToExercise,
  linkMachineToLocation,
  machinesForExercise,
  type MachineOption,
} from '@/features/places/repo';

type Props = {
  visible: boolean;
  exerciseId: string;
  exerciseName: string;
  /** Location of the workout; picking a machine from elsewhere links it here too. */
  locationId: string | null;
  locationName?: string;
  currentMachineId: string | null;
  onDismiss: () => void;
  onPick: (machineId: string | null) => void;
};

/** Picks the machine for an exercise: the ones already used for it, the others at this location, then every other machine. */
export function MachinePicker({
  visible,
  exerciseId,
  exerciseName,
  locationId,
  locationName,
  currentMachineId,
  onDismiss,
  onPick,
}: Props) {
  const [options, setOptions] = useState<Awaited<ReturnType<typeof machinesForExercise>> | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) machinesForExercise(exerciseId, locationId).then(setOptions);
  }, [visible, exerciseId, locationId]);

  const pick = async (machineId: string | null) => {
    // A machine from another exercise becomes one of this exercise's machines (also from the routine editor).
    if (machineId) await linkMachineToExercise(machineId, exerciseId);
    if (machineId && locationId) await linkMachineToLocation(machineId, locationId);
    onPick(machineId);
    close();
  };
  const close = () => {
    setCreating(false);
    setName('');
    onDismiss();
  };
  const openMachine = (id: string) => {
    close();
    router.push({ pathname: '/machines/[id]', params: { id } });
  };

  const row = (o: MachineOption, showLocations: boolean) => (
    <List.Item
      key={o.machine.id}
      title={o.machine.name}
      description={
        showLocations ? (o.locations.length ? o.locations.map((l) => l.name).join(', ') : 'Sem local') : undefined
      }
      left={(p) => <MachineThumb photo={o.machine.photo} style={p.style} />}
      right={(p) => (
        <View style={styles.rowRight}>
          {o.machine.id === currentMachineId && <List.Icon {...p} icon="check" />}
          {/* The machine's screen: photo, locations and history. */}
          <IconButton
            icon={o.machine.photo ? 'information-outline' : 'camera-plus-outline'}
            accessibilityLabel={o.machine.photo ? `Detalhes de ${o.machine.name}` : `Tirar foto de ${o.machine.name}`}
            onPress={() => openMachine(o.machine.id)}
          />
        </View>
      )}
      onPress={() => pick(o.machine.id)}
    />
  );

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={close} style={styles.dialog}>
        <Dialog.Title>{creating ? 'Nova máquina' : 'Máquina'}</Dialog.Title>
        {creating ? (
          <>
            <Dialog.Content style={styles.form}>
              <TextInput
                mode="outlined"
                label="Nome (ex.: Powergym do canto esquerdo)"
                value={name}
                onChangeText={setName}
                autoFocus
              />
              <Text variant="bodySmall">
                {locationName ? `Ela também passa a fazer parte de ${locationName}.` : 'Você pode associá-la a locais depois.'}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setCreating(false)}>Voltar</Button>
              <Button
                mode="contained"
                disabled={!name.trim()}
                onPress={async () => pick(await createMachine({ name: name.trim(), exerciseId, locationId }))}>
                Criar
              </Button>
            </Dialog.Actions>
          </>
        ) : (
          <>
            <Dialog.Content>
              <Text variant="bodyMedium">{exerciseName} · o “Anterior” e os PRs são separados por máquina</Text>
            </Dialog.Content>
            <Dialog.ScrollArea style={styles.scroll}>
              <ScrollView>
                {options && options.forExercise.length > 0 && <List.Subheader>Usadas neste exercício</List.Subheader>}
                {options?.forExercise.map((o) => row(o, true))}
                {options && options.here.length > 0 && (
                  <List.Subheader>{locationName ? `Neste local · ${locationName}` : 'Neste local'}</List.Subheader>
                )}
                {options?.here.map((o) => row(o, false))}
                {options && options.others.length > 0 && <List.Subheader>Outras máquinas</List.Subheader>}
                {options?.others.map((o) => row(o, true))}
                <List.Item
                  title="Sem máquina específica"
                  right={(p) => (currentMachineId == null ? <List.Icon {...p} icon="check" /> : null)}
                  onPress={() => pick(null)}
                />
                <Divider />
                <List.Item
                  title="Nova máquina"
                  description="Só o nome"
                  left={(p) => <List.Icon {...p} icon="plus" />}
                  onPress={() => setCreating(true)}
                />
              </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
              <Button onPress={close}>Fechar</Button>
            </Dialog.Actions>
          </>
        )}
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '85%' },
  scroll: { paddingHorizontal: 0, maxHeight: 440 },
  form: { gap: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
});
