import { and, count, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { List, Text } from 'react-native-paper';

import { PrimaryFab } from '@/components/primary-fab';
import { db } from '@/db/client';
import { locationMachines, locations } from '@/db/schema';
import { useCurrentLocation } from '@/features/places/current';
import { LOCATION_KIND_LABEL } from '@/features/places/queries';

export default function LocationsScreen() {
  const currentId = useCurrentLocation((s) => s.id);
  const { data } = useLiveQuery(
    db
      .select({ location: locations, machines: count(locationMachines.id) })
      .from(locations)
      .leftJoin(locationMachines, and(eq(locationMachines.locationId, locations.id), isNull(locationMachines.deletedAt)))
      .where(isNull(locations.deletedAt))
      .groupBy(locations.id)
      .orderBy(locations.name),
  );

  return (
    <View style={styles.flex}>
      <FlatList
        data={data}
        keyExtractor={(r) => r.location.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text variant="bodyMedium" style={styles.intro}>
            Onde você treina. As máquinas são opcionais e vão sendo associadas ao local conforme você as usa nos
            treinos.
          </Text>
        }
        renderItem={({ item: { location, machines } }) => (
          <List.Item
            title={location.name + (location.id === currentId ? '  · atual' : '')}
            description={`${LOCATION_KIND_LABEL[location.kind]} · ${machines} ${machines === 1 ? 'máquina' : 'máquinas'}`}
            left={(p) => <List.Icon {...p} icon={location.kind === 'box' ? 'home-variant-outline' : 'dumbbell'} />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push({ pathname: '/locations/[id]', params: { id: location.id } })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="titleMedium">Nenhum local ainda</Text>
            <Text variant="bodyMedium">Cadastre sua academia ou seu box.</Text>
          </View>
        }
      />
      <PrimaryFab icon="plus" label="Novo local" onPress={() => router.push('/locations/new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 96 },
  intro: { paddingHorizontal: 16, paddingVertical: 12, opacity: 0.8 },
  empty: { alignItems: 'center', padding: 32, gap: 8 },
});
