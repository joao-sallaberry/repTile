import { StyleSheet, View } from 'react-native';
import { Button, ProgressBar, Surface, Text, useTheme } from 'react-native-paper';

import { useTimerStore } from '@/features/timer/store';
import { useTimerSnapshot } from '@/features/timer/use-timer-snapshot';
import { formatDuration } from '@/lib/format';

/** Sticky bar for the running rest: time left, +30s and skip. */
export function RestTimerBar({ sessionId }: { sessionId: string }) {
  const active = useTimerStore((s) => s.active);
  const timer = active && active.sessionId === sessionId && active.spec.kind === 'rest' ? active : null;
  const snap = useTimerSnapshot(timer);
  const theme = useTheme();
  if (!timer || !snap || snap.phase === 'done') return null;

  const store = useTimerStore.getState();
  return (
    <Surface style={[styles.bar, { backgroundColor: theme.colors.secondaryContainer }]} elevation={2}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>
            {timer.label}
          </Text>
          <Text variant="displaySmall" style={[styles.time, { color: theme.colors.onSecondaryContainer }]}>
            {formatDuration(snap.displaySec)}
          </Text>
        </View>
        <Button mode="text" onPress={() => store.addSeconds(-15)} textColor={theme.colors.onSecondaryContainer}>
          −15s
        </Button>
        <Button mode="text" onPress={() => store.addSeconds(30)} textColor={theme.colors.onSecondaryContainer}>
          +30s
        </Button>
        <Button mode="contained-tonal" onPress={store.stop}>
          Pular
        </Button>
      </View>
      <ProgressBar progress={snap.progress ?? 0} color={theme.colors.secondary} style={styles.progress} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  bar: { margin: 12, marginBottom: 0, borderRadius: 16, padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
  time: { fontVariant: ['tabular-nums'] },
  progress: { borderRadius: 4 },
});
