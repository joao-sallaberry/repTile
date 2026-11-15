import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { NumberField } from '@/components/number-field';
import { TimeStepper } from '@/components/time-stepper';
import type { BlockConfig } from '@/features/workouts/blocks';

/** Settings of a WOD block: duration (AMRAP), interval/rounds/alternating (EMOM), rounds/cap (For Time), work/rest/rounds (Tabata). */
export function BlockConfigFields({
  config,
  onChange,
}: {
  config: BlockConfig;
  onChange: (patch: Partial<BlockConfig>) => void;
}) {
  switch (config.kind) {
    case 'exercises':
      return null;
    case 'amrap':
      return (
        <TimeStepper label="Duração" step={60} value={config.durationSec} onChange={(durationSec) => onChange({ durationSec })} />
      );
    case 'emom':
      return (
        <View style={styles.box}>
          <TimeStepper
            label="Intervalo"
            step={15}
            max={10 * 60}
            value={config.intervalSec}
            onChange={(intervalSec) => onChange({ intervalSec })}
          />
          <NumberField label="Intervalos" value={config.rounds} onChange={(rounds) => onChange({ rounds })} />
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text variant="bodyLarge">Alternar movimentos</Text>
              <Text variant="bodySmall" style={styles.muted}>
                {config.alternate
                  ? 'Um movimento por intervalo, em sequência (1º min: A, 2º: B, …)'
                  : 'Todos os movimentos em cada intervalo'}
              </Text>
            </View>
            <Switch value={config.alternate} onValueChange={(alternate) => onChange({ alternate })} />
          </View>
        </View>
      );
    case 'for_time':
      return (
        <View style={styles.row}>
          <NumberField style={styles.flex} label="Rounds" value={config.rounds} onChange={(rounds) => onChange({ rounds })} />
          <TimeStepper
            style={styles.flex}
            label="Time cap"
            step={60}
            value={config.timeCapSec}
            onChange={(timeCapSec) => onChange({ timeCapSec })}
          />
        </View>
      );
    case 'tabata':
      return (
        <View style={styles.box}>
          <View style={styles.row}>
            <TimeStepper
              style={styles.flex}
              label="Trabalho"
              step={5}
              max={5 * 60}
              value={config.workSec}
              onChange={(workSec) => onChange({ workSec })}
            />
            <TimeStepper
              style={styles.flex}
              label="Descanso"
              step={5}
              min={0}
              max={5 * 60}
              value={config.restSec}
              onChange={(restSec) => onChange({ restSec })}
            />
          </View>
          <NumberField label="Rounds" value={config.rounds} onChange={(rounds) => onChange({ rounds })} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  box: { gap: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  muted: { opacity: 0.7 },
});
