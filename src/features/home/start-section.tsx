import { StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { beginFreeWorkout, beginRoutine } from '@/features/session/begin';

import { describeShape } from '@/features/workouts/blocks';

import type { RoutineRow } from './queries';
import { nextInRotation, relativeDays } from './stats';

/** "Começar": the next routine in the rotation, plus an empty "Treino livre". */
export function StartSection({ routines, now }: { routines: RoutineRow[]; now: number }) {
  const theme = useTheme();
  const next = nextInRotation(
    routines,
    new Map(routines.flatMap((r) => (r.lastDoneAt ? [[r.id, r.lastDoneAt] as const] : []))),
  );

  return (
    <View style={styles.section}>
      <Text variant="titleLarge">Começar</Text>
      {next && (
        <Card mode="contained" style={{ backgroundColor: '#23140A', borderColor: theme.colors.primaryContainer, borderWidth: 1 }}>
          <Card.Content style={styles.next}>
            <Text variant="labelSmall" style={[styles.tag, { backgroundColor: theme.colors.primaryContainer, color: theme.colors.onPrimaryContainer }]}>
              PRÓXIMO DA ROTAÇÃO
            </Text>
            <View style={styles.nextText}>
              <Text variant="headlineSmall">{next.name}</Text>
              <Text variant="bodyMedium" style={styles.muted}>
                {describeShape(next.blocks)} · última vez{' '}
                {next.lastDoneAt ? relativeDays(next.lastDoneAt, now) : 'nunca'}
              </Text>
            </View>
            <Button mode="contained" icon="play" onPress={() => beginRoutine(next.id)} contentStyle={styles.bigBtn}>
              Iniciar {next.name}
            </Button>
          </Card.Content>
        </Card>
      )}
      <TouchableRipple
        onPress={beginFreeWorkout}
        borderless
        accessibilityRole="button"
        style={[styles.free, { borderColor: theme.colors.outlineVariant }]}>
        <View style={styles.freeInner}>
          <View style={[styles.freeIcon, { backgroundColor: theme.colors.elevation.level2 }]}>
            <Icon source="plus" size={22} color={theme.colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text variant="titleMedium">Treino livre</Text>
            <Text variant="bodySmall" style={styles.muted}>
              Comece vazio e adicione exercícios na hora
            </Text>
          </View>
        </View>
      </TouchableRipple>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: 10 },
  next: { gap: 12 },
  nextText: { gap: 4 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', letterSpacing: 0.6 },
  muted: { opacity: 0.75 },
  bigBtn: { height: 52 },
  free: { borderRadius: 18, borderWidth: 2, borderStyle: 'dashed' },
  freeInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 64 },
  freeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
