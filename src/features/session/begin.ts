import { router } from 'expo-router';
import { Alert } from 'react-native';

import { useCurrentLocation } from '@/features/places/current';

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

export const beginRoutine = (workoutId: string) =>
  beginSession(() => startSession(workoutId, useCurrentLocation.getState().id));

export const beginFreeWorkout = () => beginSession(() => startEmptySession(useCurrentLocation.getState().id));
