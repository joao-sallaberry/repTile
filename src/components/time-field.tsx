import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** A tappable "label · HH:MM" row that opens the system time picker; keeps the day of `value`. */
export function TimeField({ label, value, onChange }: { label: string; value: number; onChange: (ms: number) => void }) {
  const theme = useTheme();
  const open = () =>
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode: 'time',
      is24Hour: true,
      onValueChange: (_event, date) => onChange(date.getTime()),
    });

  return (
    <TouchableRipple
      onPress={open}
      borderless
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${timeFmt.format(value)}. Toque para ajustar`}
      style={[styles.box, { backgroundColor: theme.colors.elevation.level3 }]}>
      <View style={styles.inner}>
        <Text variant="labelMedium" style={styles.muted}>
          {label}
        </Text>
        <View style={styles.row}>
          <Text variant="titleLarge">{timeFmt.format(value)}</Text>
          <Icon source="pencil-outline" size={16} />
        </View>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, borderRadius: 12 },
  inner: { padding: 12, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { opacity: 0.7 },
});
