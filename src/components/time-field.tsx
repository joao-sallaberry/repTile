import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

type FieldProps = { label: string; value: number; onChange: (ms: number) => void };

/** A tappable "label · HH:MM" box that opens the system time picker; keeps the day of `value`. */
export function TimeField(props: FieldProps) {
  return <PickerField {...props} mode="time" format={timeFmt} />;
}

/** A tappable "label · date" box that opens the system date picker (no future days); keeps the time of `value`. */
export function DateField(props: FieldProps) {
  return <PickerField {...props} mode="date" format={dateFmt} />;
}

function PickerField({ label, value, onChange, mode, format }: FieldProps & { mode: 'date' | 'time'; format: Intl.DateTimeFormat }) {
  const theme = useTheme();
  const open = () =>
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode,
      is24Hour: true,
      maximumDate: mode === 'date' ? new Date() : undefined,
      onValueChange: (_event, date) => onChange(date.getTime()),
    });

  return (
    <TouchableRipple
      onPress={open}
      borderless
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${format.format(value)}. Toque para ajustar`}
      style={[styles.box, mode === 'time' && styles.half, { backgroundColor: theme.colors.elevation.level3 }]}>
      <View style={styles.inner}>
        <Text variant="labelMedium" style={styles.muted}>
          {label}
        </Text>
        <View style={styles.row}>
          <Text variant="titleLarge">{format.format(value)}</Text>
          <Icon source="pencil-outline" size={16} />
        </View>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 12 },
  half: { flex: 1 },
  inner: { padding: 12, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { opacity: 0.7 },
});
