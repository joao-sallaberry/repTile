import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { FAB, useTheme } from 'react-native-paper';

/** The screen's main "+" action: filled orange at the bottom right (Paper's default FAB is the dark primary container). */
export function PrimaryFab({ style, ...props }: ComponentProps<typeof FAB>) {
  const theme = useTheme();
  return <FAB color={theme.colors.onPrimary} style={[styles.fab, { backgroundColor: theme.colors.primary }, style]} {...props} />;
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
