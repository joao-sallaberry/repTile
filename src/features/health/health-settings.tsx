import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { Button, List, useTheme } from 'react-native-paper';

import {
  healthStatus,
  latestExercise,
  openHealthConnectSettings,
  requestHealthPermissions,
  type HealthStatus,
} from './client';
import { HealthImportSettings } from './import-settings';
import { autoLinkMessage, exerciseName, sourceLabel, type HealthExercise } from './match';
import { autoLinkSessions } from './repo';
import { SourceHint } from './source-hint';

const whenFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const PLAY_STORE = 'market://details?id=com.google.android.apps.healthdata';

/** Ajustes › Google Health: connect to Health Connect and link the last 30 days of workouts. */
export function HealthSettings() {
  const theme = useTheme();
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [linking, setLinking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  /** Latest exercise in Health Connect (null = none in 30 days, undefined = unknown). */
  const [latest, setLatest] = useState<HealthExercise | null | undefined>(undefined);

  const refresh = useCallback(() => {
    healthStatus()
      .then(async (s) => {
        setStatus(s);
        setLatest(s === 'granted' ? await latestExercise().catch(() => undefined) : undefined);
      })
      .catch(() => setStatus('unavailable'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
      return () => sub.remove();
    }, [refresh]),
  );

  if (Platform.OS !== 'android' || !status) return null;

  const linkAll = async () => {
    setLinking(true);
    setResult(null);
    try {
      const r = await autoLinkSessions();
      setResult(autoLinkMessage(r));
      setLatest(await latestExercise().catch(() => undefined));
    } catch {
      setResult('Não foi possível ler o Health Connect');
    } finally {
      setLinking(false);
    }
  };

  return (
    <>
      <List.Item
        title="Health Connect"
        description={
          status === 'granted'
            ? 'Conectado: exercícios, frequência cardíaca e calorias'
            : status === 'not_granted'
              ? 'Permita ler exercícios e frequência cardíaca'
              : status === 'update_required'
                ? 'Instale ou atualize o Health Connect'
                : 'Indisponível neste aparelho'
        }
        descriptionNumberOfLines={2}
        left={(p) => <List.Icon {...p} icon="heart-pulse" />}
        right={(p) =>
          status === 'granted' ? (
            <List.Icon {...p} icon="check-circle" color={theme.colors.primary} />
          ) : status === 'not_granted' ? (
            <Button onPress={() => requestHealthPermissions().then(refresh, refresh)}>Conectar</Button>
          ) : status === 'update_required' ? (
            <Button onPress={() => Linking.openURL(PLAY_STORE)}>Abrir</Button>
          ) : null
        }
        onPress={status === 'granted' ? openHealthConnectSettings : undefined}
      />
      {status === 'granted' && latest === null && <SourceHint />}
      {status === 'granted' && latest && (
        <List.Item
          title="Último exercício recebido"
          description={[exerciseName(latest), whenFmt.format(latest.start), sourceLabel(latest.source)]
            .filter(Boolean)
            .join(' · ')}
          descriptionNumberOfLines={2}
          left={(p) => <List.Icon {...p} icon="watch-variant" />}
        />
      )}
      {status === 'granted' && (
        <List.Item
          title="Vincular treinos dos últimos 30 dias"
          description={result ?? 'Liga cada treino ao exercício do Google Health no mesmo horário'}
          descriptionNumberOfLines={4}
          disabled={linking}
          left={(p) => <List.Icon {...p} icon="link-variant" />}
          right={(p) => (linking ? <List.Icon {...p} icon="timer-sand" /> : null)}
          onPress={linkAll}
        />
      )}
      {status === 'granted' && <HealthImportSettings />}
    </>
  );
}
