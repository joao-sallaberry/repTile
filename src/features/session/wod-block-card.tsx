import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, IconButton, List, Portal, Text, useTheme } from 'react-native-paper';

import { BlockConfigFields } from '@/components/block-config-fields';
import { ExercisePicker } from '@/components/exercise-picker';
import { NumberField } from '@/components/number-field';
import type { SessionBlock, SessionSet } from '@/db/schema';
import { useTimerStore } from '@/features/timer/store';
import { BLOCK_KIND_ICON, describeBlockFormat, type BlockConfig } from '@/features/workouts/blocks';
import { describeItem, describeResult, describeRounds } from '@/features/workouts/describe';
import { useExerciseMap } from '@/features/workouts/queries';

import { addExerciseToSession, removeExercise, removeSessionBlock, resetBlock, updateSessionBlock, updateSet } from './repo';
import { startBlockTimer } from './wod-runner';

/** A WOD block inside the session: its movements (editable until done), "Iniciar" and the result. */
export function WodBlockCard({ block, movements }: { block: SessionBlock; movements: SessionSet[] }) {
  const theme = useTheme();
  const exerciseMap = useExerciseMap();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<BlockConfig>(block);
  const done = block.finishedAt != null;
  const running = useTimerStore((s) => s.active?.blockId === block.id);
  const result = done ? describeResult(block) : null;

  const confirmRemove = () =>
    Alert.alert('Remover bloco?', `${describeBlockFormat(block)} sai só deste treino; a rotina não muda.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removeSessionBlock(block.id) },
    ]);

  // Something to undo: a saved result, rounds/reps counted, or a timer running.
  const hasProgress = done || running || !!block.roundSplits?.length || !!block.roundReps?.length || !!block.resultRounds;
  const confirmReset = () =>
    Alert.alert(
      'Zerar bloco?',
      done ? 'O resultado salvo é apagado e o bloco volta a ficar por fazer.' : 'O timer e os rounds contados até agora são apagados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Zerar',
          style: 'destructive',
          onPress: () => {
            if (running) useTimerStore.getState().stop();
            void resetBlock(block.id);
          },
        },
      ],
    );

  return (
    <Card mode="contained" style={{ borderColor: theme.colors.secondaryContainer, borderWidth: 1 }}>
      <Card.Title
        title={describeBlockFormat(block)}
        subtitle={
          block.alternate
            ? 'Um movimento por intervalo, em sequência'
            : block.kind === 'tabata' && movements.length > 1
              ? 'Um movimento por round, em sequência'
              : undefined
        }
        left={(p) => <List.Icon {...p} icon={BLOCK_KIND_ICON[block.kind]} color={theme.colors.secondary} />}
        right={() => (
          <View style={styles.row}>
            {hasProgress && <IconButton icon="restore" accessibilityLabel="Zerar bloco" onPress={confirmReset} />}
            {!done && (
              <IconButton
                icon="tune-variant"
                accessibilityLabel="Configurar bloco"
                onPress={() => {
                  setConfig(block);
                  setConfigOpen(true);
                }}
              />
            )}
            {!done && <IconButton icon="delete-outline" accessibilityLabel="Remover bloco" onPress={confirmRemove} />}
          </View>
        )}
      />
      <Card.Content style={styles.content}>
        {movements.map((m, i) => {
          const ex = exerciseMap.get(m.exerciseId);
          const measure = ex?.measure ?? 'reps';
          return (
            <View key={m.id} style={styles.movement}>
              <Text variant="bodyLarge" style={styles.flex} numberOfLines={2}>
                {block.alternate ? `${i + 1}. ` : ''}
                {ex?.name ?? '—'}
                {done ? <Text style={styles.muted}>{`  ${describeItem(m, block.kind)}`}</Text> : null}
              </Text>
              {!done && (measure === 'reps' || measure === 'weight_reps') && (
                <NumberField
                  label="Reps"
                  style={styles.num}
                  value={m.reps}
                  onChange={(reps) => updateSet(m.id, { reps })}
                />
              )}
              {!done && measure === 'weight_reps' && (
                <NumberField
                  label="kg"
                  decimal
                  style={styles.num}
                  value={m.weight}
                  onChange={(weight) => updateSet(m.id, { weight })}
                />
              )}
              {!done && (
                <IconButton
                  icon="close"
                  size={18}
                  accessibilityLabel={`Remover ${ex?.name ?? 'movimento'}`}
                  onPress={() => removeExercise(m.sessionId, m.position)}
                />
              )}
            </View>
          );
        })}
        {!done && (
          <Button icon="plus" mode="text" compact style={styles.start} onPress={() => setPickerOpen(true)}>
            Movimento
          </Button>
        )}
        {done ? (
          <View style={styles.result}>
            <Text variant="headlineSmall">{result ?? 'Feito'}</Text>
            {block.isPr && (
              <Text
                variant="labelSmall"
                style={[styles.badge, { backgroundColor: theme.colors.tertiaryContainer, color: theme.colors.onTertiaryContainer }]}>
                PR
              </Text>
            )}
          </View>
        ) : (
          <Button
            mode="contained"
            icon={running ? 'timer-outline' : 'play'}
            buttonColor={theme.colors.secondary}
            textColor={theme.colors.onSecondary}
            disabled={movements.length === 0}
            contentStyle={styles.bigBtn}
            onPress={() => {
              if (!running) startBlockTimer(block);
              router.push({ pathname: '/wod/[id]', params: { id: block.id } });
            }}>
            {running ? 'Voltar ao timer' : `Iniciar ${describeBlockFormat(block)}`}
          </Button>
        )}
        {!done && !running && (
          <Button
            mode="text"
            compact
            disabled={movements.length === 0}
            style={styles.start}
            onPress={() => router.push({ pathname: '/wod/[id]', params: { id: block.id } })}>
            Registrar resultado sem timer
          </Button>
        )}
        {done && describeRounds(block) && (
          <Text variant="bodyMedium" style={styles.muted}>
            {describeRounds(block)}
          </Text>
        )}
      </Card.Content>

      <ExercisePicker
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        onPick={(exerciseId) => addExerciseToSession(block.sessionId, block.id, exerciseId)}
      />
      <Portal>
        <Dialog visible={configOpen} onDismiss={() => setConfigOpen(false)}>
          <Dialog.Title>{describeBlockFormat(config)}</Dialog.Title>
          <Dialog.Content>
            <BlockConfigFields config={config} onChange={(patch) => setConfig({ ...config, ...patch })} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfigOpen(false)}>Cancelar</Button>
            <Button
              mode="contained"
              onPress={async () => {
                const { durationSec, intervalSec, rounds, timeCapSec, workSec, restSec, alternate } = config;
                await updateSessionBlock(block.id, { durationSec, intervalSec, rounds, timeCapSec, workSec, restSec, alternate });
                setConfigOpen(false);
              }}>
              Salvar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  // Card.Content only pads its bottom when it's the card's last child; the picker and dialog come after it.
  content: { gap: 8, paddingBottom: 16 },
  movement: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  num: { width: 72 },
  muted: { opacity: 0.7 },
  start: { alignSelf: 'flex-start' },
  bigBtn: { height: 50 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
});
