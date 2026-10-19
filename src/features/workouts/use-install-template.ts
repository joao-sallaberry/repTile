import { router } from 'expo-router';
import { useState } from 'react';

import { installTemplate, type WorkoutTemplate } from './templates';

/**
 * Saves a template's routines and opens the result: the routine itself when
 * there is one, else the Treinos tab. `installing` is the key being saved.
 */
export function useInstallTemplate() {
  const [installing, setInstalling] = useState<string | null>(null);
  const apply = async (t: WorkoutTemplate) => {
    setInstalling(t.key);
    try {
      const ids = await installTemplate(t);
      if (ids.length === 1) router.push({ pathname: '/workout/[id]', params: { id: ids[0] } });
      else router.push('/workouts');
    } finally {
      setInstalling(null);
    }
  };
  return { installing, apply };
}
