import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Checkbox, Dialog, List, Portal, Text } from 'react-native-paper';

import type { RoutineUpdateOptions } from './routine-update';

const PARTS: { key: keyof RoutineUpdateOptions; title: string; description: string }[] = [
  {
    key: 'structure',
    title: 'Exercícios e ordem',
    description: 'Adiciona os exercícios e blocos incluídos hoje, tira os removidos e segue a ordem de hoje',
  },
  {
    key: 'values',
    title: 'Séries, cargas e descanso',
    description: 'As metas passam a ser as séries, reps, cargas e o descanso feitos hoje',
  },
];

/**
 * "Atualizar rotina?" (issue #5): pick what the routine takes from the session, either part or both. A part that
 * wouldn't change anything (`available`) is disabled.
 */
export function RoutineUpdateDialog({
  available,
  onDismiss,
  onConfirm,
}: {
  /** `null` = hidden. */
  available: RoutineUpdateOptions | null;
  onDismiss: () => void;
  onConfirm: (options: RoutineUpdateOptions) => void;
}) {
  return (
    <Portal>
      <Dialog visible={available != null} onDismiss={onDismiss}>
        {available && <Content available={available} onDismiss={onDismiss} onConfirm={onConfirm} />}
      </Dialog>
    </Portal>
  );
}

function Content({
  available,
  onDismiss,
  onConfirm,
}: {
  available: RoutineUpdateOptions;
  onDismiss: () => void;
  onConfirm: (options: RoutineUpdateOptions) => void;
}) {
  const [picked, setPicked] = useState<RoutineUpdateOptions>(available);
  const any = picked.structure || picked.values;

  return (
    <>
      <Dialog.Title>Atualizar rotina?</Dialog.Title>
      <Dialog.Content style={styles.content}>
        <Text variant="bodyMedium">Escolha o que a rotina leva deste treino.</Text>
        {PARTS.map((p) => {
          const disabled = !available[p.key];
          const toggle = () => setPicked((o) => ({ ...o, [p.key]: !o[p.key] }));
          return (
            <List.Item
              key={p.key}
              title={p.title}
              description={disabled ? 'Igual à rotina' : p.description}
              descriptionNumberOfLines={3}
              disabled={disabled}
              onPress={toggle}
              style={[styles.item, disabled && styles.disabled]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: picked[p.key], disabled }}
              left={() => (
                <Checkbox.Android status={picked[p.key] ? 'checked' : 'unchecked'} disabled={disabled} onPress={toggle} />
              )}
            />
          );
        })}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancelar</Button>
        <Button disabled={!any} onPress={() => onConfirm(picked)}>
          Atualizar
        </Button>
      </Dialog.Actions>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: 4 },
  item: { paddingHorizontal: 0 },
  disabled: { opacity: 0.5 },
});
