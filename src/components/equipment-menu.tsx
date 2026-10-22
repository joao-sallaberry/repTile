import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Menu, Text, TouchableRipple } from 'react-native-paper';

import type { Equipment } from '@/db/schema';
import { equipmentLabel } from '@/features/workouts/equipment';

/**
 * The equipment used for an exercise done with several ("Halter ▾"), to switch between them.
 * Only rendered when there is a choice: `options` is the exercise's list.
 */
export function EquipmentMenu({
  options,
  value,
  onChange,
  pill,
}: {
  options: Equipment[];
  value: Equipment;
  onChange: (e: Equipment) => void;
  /** Outlined pill (routine editor) instead of plain text. */
  pill?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (options.length < 2) return null;
  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={
        <TouchableRipple
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${equipmentLabel(value)}. Toque para trocar o equipamento`}
          style={pill ? styles.pill : styles.chip}>
          <View style={styles.row}>
            <Text variant={pill ? 'labelLarge' : 'bodySmall'} style={pill ? undefined : styles.muted}>
              {equipmentLabel(value)}
            </Text>
            <IconButton icon="menu-down" size={16} style={styles.icon} />
          </View>
        </TouchableRipple>
      }>
      {options.map((e) => (
        <Menu.Item
          key={e}
          title={equipmentLabel(e)}
          leadingIcon={e === value ? 'check' : undefined}
          onPress={() => {
            setOpen(false);
            if (e !== value) onChange(e);
          }}
        />
      ))}
    </Menu>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', borderRadius: 8, minHeight: 32, justifyContent: 'center', paddingLeft: 4 },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 17,
    minHeight: 34,
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: '#3A3F49',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  muted: { opacity: 0.7 },
  icon: { margin: 0, width: 20 },
});
