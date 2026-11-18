import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, Card, List, Text, useTheme } from 'react-native-paper';

import { useCurrentLocation } from '@/features/places/current';
import { beginFreeWorkout, beginReadyWorkout } from '@/features/session/begin';
import { isStrength, READY_WORKOUTS } from '@/features/workouts/ready-workouts';

/** Home with no routines and no history yet. */
export function FirstUse() {
  const theme = useTheme();
  const hasLocation = useCurrentLocation((s) => !!s.id);

  return (
    <View style={styles.section}>
      <View style={styles.intro}>
        <Image source={require('@/assets/images/icon.png')} style={styles.mascot} contentFit="cover" />
        <Text variant="headlineSmall" style={styles.center}>
          Bora pro primeiro treino?
        </Text>
        <Text variant="bodyMedium" style={[styles.center, styles.muted]}>
          Comece agora sem planejar nada, ou monte uma rotina para repetir toda semana.
        </Text>
      </View>

      <Button mode="contained" icon="play" onPress={beginFreeWorkout} contentStyle={styles.bigBtn}>
        Começar treino livre
      </Button>
      <Button mode="contained-tonal" icon="plus" onPress={() => router.push('/workout/edit')} contentStyle={styles.bigBtn}>
        Criar uma rotina
      </Button>

      <Text variant="labelMedium" style={[styles.muted, styles.caps]}>
        OU FAÇA UM TREINO PRONTO
      </Text>
      <View style={styles.grid}>
        {READY_WORKOUTS.map((w) => (
          <Card
            key={w.key}
            mode="contained"
            style={styles.ready}
            onPress={() => void beginReadyWorkout(w)}
            accessibilityLabel={`Começar o treino pronto ${w.name}`}>
            <Card.Content style={styles.readyContent}>
              <Text variant="titleSmall">{w.name}</Text>
              <Text variant="bodySmall" style={isStrength(w) ? styles.muted : { color: theme.colors.secondary }}>
                {w.subtitle}
              </Text>
            </Card.Content>
          </Card>
        ))}
      </View>

      {!hasLocation && (
        <Card mode="outlined" onPress={() => router.push('/locations/new')}>
          <List.Item
            title="Onde você treina?"
            description="Cadastre sua academia ou box (opcional)"
            left={(p) => <List.Icon {...p} icon="map-marker-outline" color={theme.colors.primary} />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
          />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  intro: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  mascot: { width: 120, height: 120, borderRadius: 30 },
  center: { textAlign: 'center' },
  muted: { opacity: 0.7 },
  caps: { letterSpacing: 0.6, marginTop: 8, marginLeft: 4 },
  bigBtn: { height: 52 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ready: { flexBasis: '48%', flexGrow: 1 },
  readyContent: { gap: 2 },
});
