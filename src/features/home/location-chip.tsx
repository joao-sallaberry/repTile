import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';

import { LocationPicker } from '@/components/location-picker';
import { useCurrentLocation } from '@/features/places/current';
import { useLocation } from '@/features/places/queries';

/** The current location; tap to switch where new workouts start. */
export function LocationChip() {
  const { id, set } = useCurrentLocation();
  const location = useLocation(id);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Chip
        icon="map-marker-outline"
        onPress={() => setOpen(true)}
        style={styles.chip}
        accessibilityLabel={`Local atual: ${location?.name ?? 'nenhum'}. Toque para trocar`}>
        {location?.name ?? 'Onde você treina?'}
      </Chip>
      <LocationPicker
        visible={open}
        currentId={id}
        onDismiss={() => setOpen(false)}
        onPick={set}
        noneLabel="Nenhum local"
      />
    </>
  );
}

const styles = StyleSheet.create({ chip: { alignSelf: 'flex-start' } });
