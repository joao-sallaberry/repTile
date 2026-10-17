import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';

import type { LocationKind } from '@/db/schema';
import { useCurrentLocation } from '@/features/places/current';
import { LOCATION_KIND_LABEL } from '@/features/places/queries';
import { createLocation } from '@/features/places/repo';

export default function NewLocationScreen() {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<LocationKind>('gym');
  const [makeCurrent, setMakeCurrent] = useState(true);

  const create = async () => {
    const id = await createLocation({ name: name.trim(), kind });
    if (makeCurrent) useCurrentLocation.getState().set(id);
    router.replace({ pathname: '/locations/[id]', params: { id } });
  };

  return (
    <View style={styles.content}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button mode="contained" disabled={!name.trim()} onPress={create}>
              Criar
            </Button>
          ),
        }}
      />
      <TextInput mode="outlined" label="Nome" placeholder="Ex.: Academia do trabalho" value={name} onChangeText={setName} autoFocus />
      <SegmentedButtons
        value={kind}
        onValueChange={(v) => setKind(v as LocationKind)}
        buttons={[
          { value: 'gym', label: LOCATION_KIND_LABEL.gym, icon: 'dumbbell' },
          { value: 'box', label: LOCATION_KIND_LABEL.box, icon: 'home-variant-outline' },
        ]}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="bodyLarge">Usar como local atual</Text>
          <Text variant="bodySmall" style={styles.muted}>
            Novos treinos começam aqui
          </Text>
        </View>
        <Switch value={makeCurrent} onValueChange={setMakeCurrent} />
      </View>
      <Card mode="contained">
        <Card.Content>
          <Text variant="bodyMedium">
            Não precisa cadastrar máquinas agora. Quando você escolher uma máquina durante o treino, ela passa a fazer
            parte deste local.
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  muted: { opacity: 0.7 },
});
