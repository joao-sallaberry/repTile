import { StyleSheet, View } from 'react-native';
import { Button, Dialog, List, Portal, Text } from 'react-native-paper';

import { SET_TYPES, type SetType } from '@/db/schema';
import { SET_TYPE_LABEL } from '@/features/session/sets';

import { SetBadge } from './set-badge';

const HINT: Record<SetType, string> = {
  warmup: 'Não conta para volume nem PRs',
  normal: 'Série de trabalho, numerada em ordem',
  drop: 'Logo após a anterior, com menos carga',
  failure: 'Repetições até não conseguir mais',
};

type Props = {
  visible: boolean;
  current: SetType;
  subtitle?: string;
  onDismiss: () => void;
  onPick: (type: SetType) => void;
  onRemove?: () => void;
};

/** Lets the user change a set's type (warm-up, normal, drop set, to failure) or remove it. */
export function SetTypeDialog({ visible, current, subtitle, onDismiss, onPick, onRemove }: Props) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Tipo de série</Dialog.Title>
        {subtitle ? (
          <Dialog.Content>
            <Text variant="bodyMedium">{subtitle}</Text>
          </Dialog.Content>
        ) : null}
        <View>
          {SET_TYPES.map((t) => (
            <List.Item
              key={t}
              title={SET_TYPE_LABEL[t]}
              description={HINT[t]}
              left={() => (
                <View style={styles.badge}>
                  <SetBadge type={t} label={t === 'normal' ? '1' : undefined} />
                </View>
              )}
              right={(p) => (t === current ? <List.Icon {...p} icon="check" /> : null)}
              onPress={() => {
                onPick(t);
                onDismiss();
              }}
            />
          ))}
        </View>
        <Dialog.Actions>
          {onRemove && (
            <Button
              textColor="#FFB4B4"
              icon="delete-outline"
              onPress={() => {
                onRemove();
                onDismiss();
              }}>
              Remover série
            </Button>
          )}
          <Button onPress={onDismiss}>Fechar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({ badge: { justifyContent: 'center', paddingLeft: 16 } });
