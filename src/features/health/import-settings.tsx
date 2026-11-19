import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ActivityIndicator, Button, Checkbox, Dialog, List, Portal, Text, useTheme } from 'react-native-paper';

import { readExercises, READ_WINDOW_MS } from './client';
import { activityKey, activityNames, importMessage } from './import';
import { useHealthImportPrefs } from './import-prefs';
import { importHealthWorkouts } from './repo';

/**
 * Ajustes › Google Health › "Importar atividades" (ADR 0025): pick the activities whose records always show up
 * in the history, even without a RepTile workout at the same time. The dialog lists the activities found in
 * Health Connect in the last 30 days (and the ones already picked).
 */
export function HealthImportSettings() {
  const theme = useTheme();
  const { activities, setActivities } = useHealthImportPrefs();
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<{ name: string; count: number }[] | null>(null);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const now = Date.now();
    readExercises(now - READ_WINDOW_MS, now)
      .then((list) => live && setFound(activityNames(list)))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [open]);

  const show = () => {
    setDraft(activities);
    setFound(null);
    setError(false);
    setOpen(true);
  };
  const picked = (name: string) => draft.some((d) => activityKey(d) === activityKey(name));
  const toggle = (name: string) =>
    setDraft(picked(name) ? draft.filter((d) => activityKey(d) !== activityKey(name)) : [...draft, name]);

  const save = async () => {
    setOpen(false);
    setActivities(draft);
    if (draft.length === 0) return setResult(null);
    setBusy(true);
    try {
      setResult(importMessage(await importHealthWorkouts(draft)));
    } catch {
      setResult('Não foi possível ler o Health Connect');
    } finally {
      setBusy(false);
    }
  };

  // Picked activities missing from the last 30 days stay listed, so they can be unpicked.
  const options = [
    ...(found ?? []),
    ...activities
      .filter((a) => !found?.some((f) => activityKey(f.name) === activityKey(a)))
      .map((name) => ({ name, count: 0 })),
  ];

  return (
    <>
      <List.Item
        title="Importar atividades"
        description={
          result ??
          (activities.length
            ? `${activities.join(', ')}: aparecem no histórico mesmo sem treino no app`
            : 'Escolha atividades do relógio (ex.: CrossFit) para aparecerem sempre no histórico')
        }
        descriptionNumberOfLines={3}
        disabled={busy}
        left={(p) => <List.Icon {...p} icon="download-outline" />}
        right={(p) => <List.Icon {...p} icon={busy ? 'timer-sand' : 'chevron-right'} />}
        onPress={show}
      />
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>Importar atividades</Dialog.Title>
          <Dialog.Content style={styles.content}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Cada atividade escolhida entra no histórico só com os dados do Google Health quando não houver um treino
              do app no mesmo horário.
            </Text>
          </Dialog.Content>
          <Dialog.ScrollArea style={styles.scroll}>
            <ScrollView>
              {error ? (
                <Text style={styles.message}>Não foi possível ler o Health Connect.</Text>
              ) : found == null ? (
                <ActivityIndicator style={styles.message} />
              ) : options.length === 0 ? (
                <Text style={styles.message}>Nenhuma atividade no Health Connect nos últimos 30 dias.</Text>
              ) : (
                options.map((o) => (
                  <Checkbox.Item
                    key={activityKey(o.name)}
                    label={o.count ? `${o.name} · ${o.count}× em 30 dias` : o.name}
                    status={picked(o.name) ? 'checked' : 'unchecked'}
                    onPress={() => toggle(o.name)}
                    position="leading"
                    labelStyle={styles.label}
                  />
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Cancelar</Button>
            <Button mode="contained" onPress={save} disabled={found == null && !error}>
              Salvar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 8 },
  scroll: { maxHeight: 360, paddingHorizontal: 0 },
  message: { padding: 24 },
  label: { textAlign: 'left' },
});
