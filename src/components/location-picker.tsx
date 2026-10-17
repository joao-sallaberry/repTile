import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, Divider, List, Portal, SegmentedButtons, TextInput } from 'react-native-paper';

import type { LocationKind } from '@/db/schema';
import { LOCATION_KIND_LABEL, useLocations } from '@/features/places/queries';
import { createLocation } from '@/features/places/repo';

type Props = {
  visible: boolean;
  currentId: string | null;
  onDismiss: () => void;
  onPick: (locationId: string | null) => void;
  /** Label of the "no location" option. */
  noneLabel?: string;
};

/** Picks (or quickly creates) a location. Creating one only asks for a name and kind. */
export function LocationPicker({ visible, currentId, onDismiss, onPick, noneLabel = 'Sem local' }: Props) {
  const all = useLocations();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<LocationKind>('gym');

  const close = () => {
    setCreating(false);
    setName('');
    onDismiss();
  };
  const pick = (id: string | null) => {
    onPick(id);
    close();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={close} style={styles.dialog}>
        <Dialog.Title>{creating ? 'Novo local' : 'Local'}</Dialog.Title>
        {creating ? (
          <>
            <Dialog.Content style={styles.form}>
              <TextInput mode="outlined" label="Nome" value={name} onChangeText={setName} autoFocus />
              <SegmentedButtons
                value={kind}
                onValueChange={(v) => setKind(v as LocationKind)}
                buttons={[
                  { value: 'gym', label: LOCATION_KIND_LABEL.gym, icon: 'dumbbell' },
                  { value: 'box', label: 'Box', icon: 'home-variant-outline' },
                ]}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setCreating(false)}>Voltar</Button>
              <Button
                mode="contained"
                disabled={!name.trim()}
                onPress={async () => pick(await createLocation({ name: name.trim(), kind }))}>
                Criar
              </Button>
            </Dialog.Actions>
          </>
        ) : (
          <>
            <Dialog.ScrollArea style={styles.scroll}>
              <ScrollView>
                {all.map((l) => (
                  <List.Item
                    key={l.id}
                    title={l.name}
                    description={LOCATION_KIND_LABEL[l.kind]}
                    left={(p) => <List.Icon {...p} icon={l.kind === 'box' ? 'home-variant-outline' : 'dumbbell'} />}
                    right={(p) => (l.id === currentId ? <List.Icon {...p} icon="check" /> : null)}
                    onPress={() => pick(l.id)}
                  />
                ))}
                <List.Item
                  title={noneLabel}
                  left={(p) => <List.Icon {...p} icon="map-marker-off-outline" />}
                  right={(p) => (currentId == null ? <List.Icon {...p} icon="check" /> : null)}
                  onPress={() => pick(null)}
                />
                <Divider />
                <List.Item title="Novo local" left={(p) => <List.Icon {...p} icon="plus" />} onPress={() => setCreating(true)} />
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
  scroll: { paddingHorizontal: 0, maxHeight: 420 },
  form: { gap: 12 },
});
