import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Divider, IconButton, List, Text, useTheme } from 'react-native-paper';

import { beginRoutine } from '@/features/session/begin';
import { describeShape, workoutIcon } from '@/features/workouts/blocks';

import type { RoutineRow } from './queries';
import { relativeDays } from './stats';

/** "Seus treinos": saved routines with a ▶ to start each one right away. */
export function RoutineList({ routines, now, limit = 4 }: { routines: RoutineRow[]; now: number; limit?: number }) {
  const theme = useTheme();
  if (!routines.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="titleMedium">Seus treinos</Text>
        <Button compact onPress={() => router.push('/workouts')}>
          Ver todos
        </Button>
      </View>
      <Card mode="contained">
        {routines.slice(0, limit).map((r, i) => (
          <View key={r.id}>
            {i > 0 && <Divider />}
            <List.Item
              title={r.name}
              description={`${describeShape(r.blocks)} · ${relativeDays(r.lastDoneAt, now)}`}
              left={(p) => {
                const kinds = r.blocks.map((b) => b.kind);
                const plain = !kinds.length || kinds.includes('exercises');
                return <List.Icon {...p} icon={workoutIcon(kinds)} color={plain ? theme.colors.primary : theme.colors.secondary} />;
              }}
              right={() => (
                <IconButton
                  icon="play"
                  mode="contained-tonal"
                  accessibilityLabel={`Iniciar ${r.name}`}
                  onPress={() => beginRoutine(r.id)}
                />
              )}
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: r.id } })}
              style={styles.item}
            />
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4 },
  item: { paddingRight: 4 },
});
