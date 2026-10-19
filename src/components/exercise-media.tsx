import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';

import type { Equipment } from '@/db/schema';
import { FRAMES } from '@/features/exercises/media.generated';
import { pickMediaId } from '@/features/exercises/media-map';

/** The illustration frames (start, peak) of an exercise done with `equipment`, if there are any. */
export function exerciseFrames(exerciseId: string, equipment: Equipment | null | undefined): number[] | undefined {
  const id = pickMediaId(exerciseId, equipment);
  return id ? FRAMES[id] : undefined;
}

export const hasExerciseMedia = (exerciseId: string, equipment?: Equipment | null) => !!exerciseFrames(exerciseId, equipment);

/**
 * RepDB illustration of the exercise (ADR 0016). `animate` alternates its poses like a simple GIF (exercise screen);
 * lists show the peak pose still. Renders nothing for exercises without images.
 */
export function ExerciseMedia({
  exerciseId,
  equipment,
  size,
  animate = false,
  style,
}: {
  exerciseId: string;
  equipment?: Equipment | null;
  size: number;
  animate?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const frames = exerciseFrames(exerciseId, equipment);
  const [tick, setTick] = useState(0);
  const count = frames?.length ?? 0;

  useEffect(() => {
    if (!animate || count < 2) return;
    const t = setInterval(() => setTick((n) => n + 1), 900);
    return () => clearInterval(t);
  }, [animate, count]);

  if (!frames) return null;
  const source = animate ? frames[tick % count] : frames[count - 1];
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: size / 8, backgroundColor: theme.colors.surfaceVariant },
        style,
      ]}>
      <Image source={source} style={styles.fill} contentFit="cover" transition={animate ? 250 : 0} />
    </View>
  );
}

/** List thumbnail: the still illustration, or a placeholder icon so rows stay aligned. */
export function ExerciseThumb({
  exerciseId,
  equipment,
  size = 44,
  style,
}: {
  exerciseId: string;
  equipment?: Equipment | null;
  size?: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  if (hasExerciseMedia(exerciseId, equipment)) {
    return <ExerciseMedia exerciseId={exerciseId} equipment={equipment} size={size} style={style} />;
  }
  return (
    <View
      style={[
        styles.box,
        styles.placeholder,
        { width: size, height: size, borderRadius: size / 8, backgroundColor: theme.colors.surfaceVariant },
        style,
      ]}>
      <Icon source="dumbbell" size={size / 2} color={theme.colors.onSurfaceVariant} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
});
