import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
            <Stack screenOptions={{ headerShadowVisible: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="workout/[id]" options={{ title: 'Treino' }} />
              <Stack.Screen name="workout/edit" options={{ title: 'Editar treino', presentation: 'modal' }} />
              <Stack.Screen name="session/[id]" options={{ title: 'Treino em andamento' }} />
              <Stack.Screen name="history/[id]" options={{ title: 'Sessão' }} />
              <Stack.Screen name="exercise/[id]" options={{ title: 'Exercício' }} />
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
