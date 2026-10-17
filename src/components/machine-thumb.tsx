import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from 'react-native-paper';

import { machinePhotoUri } from '@/features/places/photos';

/** Small square with the machine's photo, or a placeholder icon. */
export function MachineThumb({ photo, size = 40, style }: { photo: string | null; size?: number; style?: StyleProp<ViewStyle> }) {
  const uri = machinePhotoUri(photo);
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size / 4 }, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Icon source="cog-outline" size={size / 2} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A2E36' },
});
