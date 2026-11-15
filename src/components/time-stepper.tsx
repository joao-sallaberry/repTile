import { useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

import { stepSeconds } from '@/features/session/times';
import { formatDuration } from '@/lib/format';

const stepLabel = (sec: number) => (sec % 60 === 0 ? (sec === 60 ? '1 minuto' : `${sec / 60} minutos`) : `${sec} segundos`);

/**
 * A time setting of a WOD block (EMOM interval, AMRAP duration, time cap, Tabata work/rest): the value between
 * − and + buttons that move it by `step` seconds (hold to repeat).
 * Replaces typing "m:ss" by hand.
 */
export function TimeStepper({
  label,
  value,
  onChange,
  step,
  min = step,
  max = 60 * 60,
  style,
}: {
  label: string;
  value: number | null;
  onChange: (sec: number) => void;
  step: number;
  min?: number;
  max?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRepeat = () => {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = null;
  };
  // While held, keep stepping from the value reached so far (the prop only catches up on the next render).
  const startRepeat = (delta: number) => {
    stopRepeat();
    let current = value;
    repeat.current = setInterval(() => {
      current = stepSeconds(current, delta, min, max);
      onChange(current);
    }, 120);
  };

  const button = (delta: number) => {
    const disabled = value != null && (delta < 0 ? value <= min : value >= max);
    return (
      <IconButton
        icon={delta < 0 ? 'minus' : 'plus'}
        mode="contained-tonal"
        size={20}
        style={styles.button}
        disabled={disabled}
        accessibilityLabel={`${delta < 0 ? 'Menos' : 'Mais'} ${stepLabel(step)} em ${label.toLowerCase()}`}
        onPress={() => onChange(stepSeconds(value, delta, min, max))}
        onLongPress={() => startRepeat(delta)}
        onPressOut={stopRepeat}
      />
    );
  };

  return (
    <View style={[styles.box, { borderColor: theme.colors.outline }, style]}>
      <Text variant="labelMedium" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <View style={styles.row}>
        {button(-step)}
        <Text
          variant="titleLarge"
          style={styles.value}
          accessibilityLabel={`${label}: ${value != null ? formatDuration(value) : 'sem valor'}`}
          accessibilityLiveRegion="polite">
          {value != null ? formatDuration(value) : '—'}
        </Text>
        {button(step)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 6, gap: 2 },
  label: { marginLeft: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  button: { margin: 0 },
  value: { flex: 1, textAlign: 'center', fontWeight: '700', fontVariant: ['tabular-nums'] },
});
