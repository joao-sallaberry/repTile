import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Checkbox, Dialog, IconButton, Portal, Text } from 'react-native-paper';

import { FilterChip } from '@/components/filter-chips';
import { REST_STEP as STEP, stepRest } from '@/features/session/times';
import { formatDuration } from '@/lib/format';

const PRESETS = [30, 45, 60, 90, 120, 180];

/**
 * Rest between sets: the value in large type with −15s / +15s (hold to repeat),
 * chips with the usual times and "Sem descanso". `onSave` gets null for no rest. With `allowAll` it offers
 * "Usar em todos os exercícios" and tells `onSave` whether it was ticked.
 */
export function RestPicker({
  visible,
  value,
  allowAll = false,
  onDismiss,
  onSave,
}: {
  visible: boolean;
  value: number | null;
  allowAll?: boolean;
  onDismiss: () => void;
  onSave: (sec: number | null, all: boolean) => void;
}) {
  const [sec, setSec] = useState(value ?? 0);
  const [all, setAll] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start from the current value each time it opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setSec(value ?? 0);
      setAll(false);
    }
  }

  const stopRepeat = () => {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = null;
  };
  const startRepeat = (delta: number) => {
    stopRepeat();
    repeat.current = setInterval(() => setSec((s) => stepRest(s, delta)), 120);
  };

  const stepper = (delta: number) => (
    <IconButton
      icon={delta < 0 ? 'minus' : 'plus'}
      mode="contained-tonal"
      size={28}
      accessibilityLabel={delta < 0 ? 'Menos 15 segundos' : 'Mais 15 segundos'}
      onPress={() => setSec((s) => stepRest(s, delta))}
      onLongPress={() => startRepeat(delta)}
      onPressOut={stopRepeat}
    />
  );

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Descanso entre séries</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <View style={styles.stepper}>
            {stepper(-STEP)}
            <Text variant="displaySmall" style={styles.value} accessibilityLiveRegion="polite">
              {sec ? formatDuration(sec) : 'Sem'}
            </Text>
            {stepper(STEP)}
          </View>
          <View style={styles.chips}>
            {PRESETS.map((p) => (
              <FilterChip key={p} selected={sec === p} onPress={() => setSec(p)}>
                {formatDuration(p)}
              </FilterChip>
            ))}
            <FilterChip selected={sec === 0} onPress={() => setSec(0)}>
              Sem descanso
            </FilterChip>
          </View>
          {allowAll && (
            <Checkbox.Item
              label="Usar em todos os exercícios"
              status={all ? 'checked' : 'unchecked'}
              onPress={() => setAll((a) => !a)}
              position="leading"
              labelStyle={styles.allLabel}
              style={styles.all}
            />
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancelar</Button>
          <Button
            mode="contained"
            onPress={() => {
              onSave(sec || null, all);
              onDismiss();
            }}>
            Salvar
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 120, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  all: { paddingHorizontal: 0, paddingVertical: 0 },
  allLabel: { textAlign: 'left' },
});
