import { router } from 'expo-router';
import { Alert } from 'react-native';

import { useCurrentLocation } from '@/features/places/current';
import type { VariantKey } from '@/features/workouts/variants';

import { getActiveSession, startEmptySession, startSession } from './repo';

/** Opens a new session, unless one is already in progress (only one at a time). */
async function beginSession(create: () => Promise<string>) {
  const active = await getActiveSession();
  if (active) {
    Alert.alert('Treino em andamento', `Finalize ou descarte "${active.name}" antes de começar outro.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Retomar', onPress: () => router.push({ pathname: '/session/[id]', params: { id: active.id } }) },
    ]);
    return;
  }
  const id = await create();
  router.push({ pathname: '/session/[id]', params: { id } });
}

/** Starts a routine: the given location variant, else the one of the current location (ADR 0020). */
export const beginRoutine = (workoutId: string, variant?: VariantKey) =>
  beginSession(() => startSession(workoutId, useCurrentLocation.getState().id, variant));

export const beginFreeWorkout = () => beginSession(() => startEmptySession(useCurrentLocation.getState().id));
