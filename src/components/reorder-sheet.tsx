import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Button, Icon, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DraggableList } from './draggable-list';

export type ReorderItem<I> = { key: string; title: string; value: I };
export type ReorderGroup<G, I> = { key: string; title: string; icon: string; value: G; items: ReorderItem<I>[] };

const byKeys = <T extends { key: string }>(list: T[], keys: string[]) =>
  keys.map((k) => list.find((x) => x.key === k)).filter((x): x is T => x != null);

/**
 * Full-screen "Reordenar": drag the blocks (when there are several) and the exercises
 * inside each block. `onSave` gets the groups and their items in the new order.
 */
export function ReorderSheet<G, I>({
  visible,
  groups: initial,
  onDismiss,
  onSave,
}: {
  visible: boolean;
  groups: ReorderGroup<G, I>[];
  onDismiss: () => void;
  onSave: (groups: ReorderGroup<G, I>[]) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState(initial);
  const [wasVisible, setWasVisible] = useState(visible);

  // Start from the current order each time it opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setGroups(initial);
  }

  const several = groups.length > 1;
  const setItems = (key: string, keys: string[]) =>
    setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, items: byKeys(g.items, keys) } : g)));

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.sheet,
          { backgroundColor: theme.colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 },
        ]}>
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.flex}>
            Reordenar
          </Text>
          <Button onPress={onDismiss}>Cancelar</Button>
          <Button
            mode="contained"
            onPress={() => {
              onSave(groups);
              onDismiss();
            }}>
            Salvar
          </Button>
        </View>
        <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
          Segure o ≡ e arraste.
        </Text>
        <ScrollView contentContainerStyle={styles.content}>
          {several && (
            <View style={styles.section}>
              <Text variant="titleSmall">Blocos</Text>
              <DraggableList
                data={groups}
                keyOf={(g) => g.key}
                onReorder={(keys) => setGroups((gs) => byKeys(gs, keys))}
                renderRow={(g) => (
                  <View style={styles.rowText}>
                    <Icon source={g.icon} size={20} color={theme.colors.primary} />
                    <View style={styles.flex}>
                      <Text variant="titleSmall" numberOfLines={1}>
                        {g.title}
                      </Text>
                      <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                        {g.items.map((i) => i.title).join(', ') || 'Sem exercícios'}
                      </Text>
                    </View>
                  </View>
                )}
              />
            </View>
          )}
          {groups
            .filter((g) => g.items.length > 1)
            .map((g) => (
              <View key={g.key} style={styles.section}>
                <Text variant="titleSmall">{several ? g.title : 'Exercícios'}</Text>
                <DraggableList
                  data={g.items}
                  keyOf={(i) => i.key}
                  onReorder={(keys) => setItems(g.key, keys)}
                  renderRow={(i) => (
                    <Text variant="bodyLarge" numberOfLines={1}>
                      {i.title}
                    </Text>
                  )}
                />
              </View>
            ))}
        </ScrollView>
      </Modal>
    </Portal>
  );
}

/** Whether there is anything to reorder: several blocks, or a block with several exercises. */
export const canReorder = (groups: { items: unknown[] }[]) => groups.length > 1 || groups.some((g) => g.items.length > 1);

const styles = StyleSheet.create({
  sheet: { flex: 1, justifyContent: 'flex-start' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  hint: { paddingHorizontal: 16, marginTop: 2 },
  content: { padding: 16, gap: 20 },
  section: { gap: 8 },
  rowText: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
});
