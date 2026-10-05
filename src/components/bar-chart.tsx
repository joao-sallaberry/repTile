import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

type Point = { label: string; value: number; highlight?: boolean };

/** Simple dependency-free bar chart for weight progression. */
export function BarChart({ data, height = 140, format = String }: { data: Point[]; height?: number; format?: (v: number) => string }) {
  const theme = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={[styles.chart, { height: height + 36 }]}>
      {data.map((d, i) => (
        <View key={i} style={styles.col}>
          <Text variant="labelSmall" numberOfLines={1}>
            {format(d.value)}
          </Text>
          <View
            style={{
              height: Math.max(4, (d.value / max) * height),
              width: '70%',
              borderRadius: 4,
              backgroundColor: d.highlight ? theme.colors.primary : theme.colors.secondaryContainer,
            }}
          />
          <Text variant="labelSmall" numberOfLines={1} style={styles.label}>
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  label: { opacity: 0.7 },
});
