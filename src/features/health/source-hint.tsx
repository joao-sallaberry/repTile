import { Button, List, useTheme } from 'react-native-paper';

import { openSourcePermissions } from './client';

/**
 * Shown when Health Connect has no exercise at all: the Google Health app must be allowed to write there, and
 * only the user can do that (one app can't grant another's permissions). Opens that permission screen.
 */
export function SourceHint() {
  const theme = useTheme();
  return (
    <List.Item
      title="O Google Health não está enviando dados"
      titleNumberOfLines={2}
      description="Permita que ele grave Exercício, Frequência cardíaca e Total de calorias no Health Connect e sincronize o relógio"
      descriptionNumberOfLines={4}
      left={(p) => <List.Icon {...p} icon="alert-circle-outline" color={theme.colors.error} />}
      right={() => <Button onPress={openSourcePermissions}>Abrir</Button>}
      onPress={openSourcePermissions}
    />
  );
}
