import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon, useTheme } from 'react-native-paper';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Height of every row: fixed so a drag offset maps straight to an index. */
export const DRAG_ROW_HEIGHT = 60;

type Positions = Record<string, number>;

const positionsOf = (keys: string[]): Positions => Object.fromEntries(keys.map((k, i) => [k, i]));

/**
 * A vertical list reordered by dragging each row's ≡ handle. Rows have a fixed height
 * (`DRAG_ROW_HEIGHT`); `onReorder` gets the keys in their new order when a drag ends.
 */
export function DraggableList<T>({
  data,
  keyOf,
  renderRow,
  onReorder,
}: {
  data: T[];
  keyOf: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  onReorder: (keys: string[]) => void;
}) {
  const keys = data.map(keyOf);
  const positions = useSharedValue<Positions>(positionsOf(keys));
  const joined = keys.join('\n');

  // A new order from the parent (after a drop, or new data) resets every row's slot.
  useEffect(() => {
    positions.set(positionsOf(joined.split('\n')));
  }, [joined, positions]);

  const commit = (p: Positions) => onReorder(Object.keys(p).sort((a, b) => p[a] - p[b]));

  return (
    <View style={{ height: data.length * DRAG_ROW_HEIGHT }}>
      {data.map((item) => {
        const key = keyOf(item);
        return (
          <Row key={key} id={key} count={data.length} positions={positions} onDrop={commit}>
            {renderRow(item)}
          </Row>
        );
      })}
    </View>
  );
}

function Row({
  id,
  count,
  positions,
  onDrop,
  children,
}: {
  id: string;
  count: number;
  positions: SharedValue<Positions>;
  onDrop: (p: Positions) => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const top = useSharedValue((positions.get()[id] ?? 0) * DRAG_ROW_HEIGHT);
  const dragging = useSharedValue(false);
  const start = useSharedValue(0);

  // Slide into place when another row takes this one's slot.
  useAnimatedReaction(
    () => positions.get()[id],
    (slot) => {
      if (!dragging.get() && slot != null) top.set(withTiming(slot * DRAG_ROW_HEIGHT, { duration: 150 }));
    },
  );

  const pan = Gesture.Pan()
    .onStart(() => {
      dragging.set(true);
      start.set(top.get());
    })
    .onUpdate((e) => {
      const y = Math.min(Math.max(start.get() + e.translationY, 0), (count - 1) * DRAG_ROW_HEIGHT);
      top.set(y);
      const slot = Math.round(y / DRAG_ROW_HEIGHT);
      const current = positions.get();
      const from = current[id];
      if (slot === from) return;
      // Swap with whichever row sits in the new slot.
      const next = { ...current };
      for (const k in next) if (next[k] === slot) next[k] = from;
      next[id] = slot;
      positions.set(next);
    })
    .onFinalize(() => {
      if (!dragging.get()) return;
      dragging.set(false);
      top.set(withSpring(positions.get()[id] * DRAG_ROW_HEIGHT, { damping: 20, stiffness: 300 }));
      scheduleOnRN(onDrop, positions.get());
    });

  const style = useAnimatedStyle(() => ({
    top: top.get(),
    zIndex: dragging.get() ? 1 : 0,
    elevation: dragging.get() ? 6 : 0,
    transform: [{ scale: withTiming(dragging.get() ? 1.02 : 1, { duration: 120 }) }],
  }));

  return (
    <Animated.View style={[styles.row, { backgroundColor: theme.colors.elevation.level2 }, style]}>
      <View style={styles.content}>{children}</View>
      <GestureDetector gesture={pan}>
        <View style={styles.handle} accessibilityLabel="Arrastar para reordenar" hitSlop={8}>
          <Icon source="drag-horizontal-variant" size={24} color={theme.colors.onSurfaceVariant} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: DRAG_ROW_HEIGHT - 6,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
  },
  content: { flex: 1, minWidth: 0 },
  handle: { width: 52, height: '100%', alignItems: 'center', justifyContent: 'center' },
});
