import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';

/** A filter or choice chip: filled orange when picked, outlined otherwise. Use it for every chip that selects something. */
export function FilterChip({
  selected,
  onPress,
  icon,
  compact,
  accessibilityLabel,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  icon?: string;
  compact?: boolean;
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Chip
      mode={selected ? 'flat' : 'outlined'}
      selected={selected}
      showSelectedCheck={false}
      icon={icon}
      compact={compact}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={selected ? { backgroundColor: theme.colors.primaryContainer } : styles.outlined}
      textStyle={{ color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }}>
      {children}
    </Chip>
  );
}

/**
 * A horizontal row of single-choice filter chips (Treinos, Histórico).
 * Rendered only when there is a choice.
 */
export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {options.map((o) => (
        <FilterChip key={o.key} selected={o.key === value} onPress={() => onChange(o.key)}>
          {o.label}
        </FilterChip>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // A horizontal ScrollView next to a flex list gets squeezed to nothing unless it can't shrink.
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { gap: 8 },
  outlined: { backgroundColor: 'transparent' },
});
