import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaperProvider, Text } from 'react-native-paper';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { seedExercises } from '@/db/seed';
import { useTimerCuePlayer } from '@/features/timer/cue-player';
import { navTheme, theme } from '@/theme';

SplashScreen.preventAutoHideAsync();

function useDatabaseReady() {
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (success) seedExercises(db).then(() => setSeeded(true));
  }, [success]);
  return { ready: success && seeded, error };
}

export default function RootLayout() {
  const { ready, error } = useDatabaseReady();
  // Android draws edge-to-edge: keep stack screens' content (footers, FABs) above the system navigation bar.
  const { bottom } = useSafeAreaInsets();
  useTimerCuePlayer();

  useEffect(() => {
    if (ready || error) SplashScreen.hideAsync();
  }, [ready, error]);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <PaperProvider theme={theme}>
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          {error ? (
            <View style={styles.center}>
              <Text variant="titleMedium">Erro ao abrir o banco de dados</Text>
              <Text>{error.message}</Text>
            </View>
          ) : ready ? (
            <Stack screenOptions={{ headerShadowVisible: false, contentStyle: { paddingBottom: bottom } }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false, contentStyle: { paddingBottom: 0 } }} />
              <Stack.Screen name="workout/[id]" options={{ title: 'Treino' }} />
              <Stack.Screen name="workout/edit" options={{ title: 'Editar treino', presentation: 'modal' }} />
              <Stack.Screen name="session/[id]" options={{ title: 'Treino em andamento' }} />
              <Stack.Screen name="wod/[id]" options={{ title: 'WOD' }} />
              <Stack.Screen name="history/[id]" options={{ title: 'Sessão' }} />
              <Stack.Screen name="summary/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="exercise/[id]" options={{ title: 'Exercício' }} />
              <Stack.Screen name="locations/index" options={{ title: 'Locais' }} />
              <Stack.Screen name="locations/new" options={{ title: 'Novo local', presentation: 'modal' }} />
              <Stack.Screen name="locations/[id]" options={{ title: 'Local' }} />
              <Stack.Screen name="machines/[id]" options={{ title: 'Máquina' }} />
              <Stack.Screen name="settings" options={{ title: 'Ajustes' }} />
              <Stack.Screen
                name="welcome"
                options={{ headerShown: false, gestureEnabled: false, contentStyle: { paddingBottom: 0 } }}
              />
            </Stack>
          ) : null}
        </ThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
});
