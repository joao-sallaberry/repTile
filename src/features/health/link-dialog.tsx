import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Dialog, List, Portal, RadioButton, Text, useTheme } from 'react-native-paper';

import type { Session, SessionHealth } from '@/db/schema';

import { healthStatus, latestExercise, requestHealthPermissions, type HealthStatus } from './client';
import { bestMatch, exerciseName, overlapLabel, sourceLabel, type HealthExercise } from './match';
import { exercisesAround, linkHealth, unlinkHealth } from './repo';
import { SourceHint } from './source-hint';

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * ⋮ › Dados do Google Health: pick the Health Connect record for a session (each one says how much of the
 * workout it covers; the linked one, else the best match, starts selected) and confirm with "Vincular", or unlink it.
 */
export function HealthLinkDialog({
  session,
  health,
  visible,
  onDismiss,
}: {
  session: Session;
  health: SessionHealth | undefined;
  visible: boolean;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [options, setOptions] = useState<HealthExercise[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  /** Health Connect has no exercise at all in the last 30 days. */
  const [empty, setEmpty] = useState(false);
  /** Bumped after the permission screen, to load again. */
  const [attempt, setAttempt] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const times = { start: session.startedAt, end: session.finishedAt ?? session.startedAt };

  useEffect(() => {
    if (!visible) return;
    let live = true;
    const load = async () => {
      setOptions(null);
      setError(false);
      setEmpty(false);
      const s = await healthStatus();
      if (!live) return;
      setStatus(s);
      if (s !== 'granted') return;
      const list = await exercisesAround(session);
      const none = list.length === 0 && (await latestExercise()) == null;
      if (!live) return;
      setEmpty(none);
      setOptions(list);
      const end = session.finishedAt ?? session.startedAt;
      const linked = list.find((o) => o.id === health?.recordId);
      setPickedId((linked ?? bestMatch({ start: session.startedAt, end }, list))?.id ?? null);
    };
    load().catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [visible, session, health?.recordId, attempt]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      onDismiss();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const muted = { color: theme.colors.onSurfaceVariant };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Dados do Google Health</Dialog.Title>
        <Dialog.ScrollArea style={styles.area}>
          <ScrollView>
            {status === 'unavailable' && (
              <Text variant="bodyMedium" style={styles.message}>
                O Health Connect não está disponível neste aparelho.
              </Text>
            )}
            {status === 'update_required' && (
              <Text variant="bodyMedium" style={styles.message}>
                Instale ou atualize o Health Connect pela Play Store.
              </Text>
            )}
            {status === 'not_granted' && (
              <Text variant="bodyMedium" style={styles.message}>
                Permita que o RepTile leia exercícios e frequência cardíaca do Health Connect.
              </Text>
            )}
            {status === 'granted' && !options && !error && <ActivityIndicator style={styles.message} />}
            {error && (
              <Text variant="bodyMedium" style={styles.message}>
                Não foi possível ler o Health Connect.
              </Text>
            )}
            {empty && <SourceHint />}
            {options?.length === 0 && !empty && (
              <Text variant="bodyMedium" style={styles.message}>
                Nenhum exercício registrado perto deste horário. O Health Connect só guarda os últimos 30 dias para o
                RepTile.
              </Text>
            )}
            {options?.map((o) => {
              const covers = overlapLabel(times, o);
              const overlaps = covers.endsWith('do treino') && covers.includes('%');
              return (
                <List.Item
                  key={o.id}
                  title={exerciseName(o)}
                  description={[`${timeFmt.format(o.start)} – ${timeFmt.format(o.end)}`, sourceLabel(o.source)]
                    .filter(Boolean)
                    .join(' · ')}
                  descriptionStyle={muted}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: pickedId === o.id }}
                  left={() => (
                    <View style={styles.radio}>
                      <RadioButton value={o.id} status={pickedId === o.id ? 'checked' : 'unchecked'} onPress={() => setPickedId(o.id)} />
                    </View>
                  )}
                  right={() => (
                    <Text
                      variant="labelSmall"
                      style={[
                        styles.badge,
                        overlaps
                          ? { backgroundColor: theme.colors.tertiaryContainer, color: theme.colors.onTertiaryContainer }
                          : { backgroundColor: theme.colors.elevation.level5, color: theme.colors.onSurfaceVariant },
                      ]}>
                      {health?.recordId === o.id ? `vinculado · ${covers}` : covers}
                    </Text>
                  )}
                  onPress={() => setPickedId(o.id)}
                />
              );
            })}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          {health && (
            <Button disabled={busy} textColor={theme.colors.error} onPress={() => run(() => unlinkHealth(session.id))}>
              Desvincular
            </Button>
          )}
          {status === 'not_granted' && (
            <Button onPress={() => requestHealthPermissions().then(() => setAttempt((a) => a + 1)).catch(() => setError(true))}>Permitir</Button>
          )}
          <Button onPress={onDismiss}>Fechar</Button>
          {options && options.length > 0 && (
            <Button
              mode="contained"
              disabled={busy || !pickedId || pickedId === health?.recordId}
              onPress={() => {
                const picked = options.find((o) => o.id === pickedId);
                if (picked) run(() => linkHealth(session.id, picked));
              }}>
              Vincular
            </Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  radio: { justifyContent: 'center', marginLeft: 8 },
  badge: { alignSelf: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  area: { paddingHorizontal: 0, maxHeight: 360 },
  message: { paddingHorizontal: 24, paddingVertical: 16 },
});
