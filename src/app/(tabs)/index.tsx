import { and, desc, isNotNull, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Divider, List, Text, useTheme } from 'react-native-paper';

import { db } from '@/db/client';
import { sessions, workouts } from '@/db/schema';
import { useCurrentLocation } from '@/features/places/current';
import { LOCATION_KIND_LABEL, useLocation } from '@/features/places/queries';
import { describeResult } from '@/features/workouts/describe';
import { formatDate } from '@/lib/format';
import { WORKOUT_TYPE_ICON, WORKOUT_TYPE_LABEL } from '@/theme';

export default function HomeScreen() {
  const theme = useTheme();
  const currentLocation = useLocation(useCurrentLocation((s) => s.id));
  const [weekAgo] = useState(() => Date.now() - 7 * 24 * 3600 * 1000);
  const { data: active } = useLiveQuery(
    db
      .select()
      .from(sessions)
      .where(and(isNull(sessions.finishedAt), isNull(sessions.deletedAt)))
      .orderBy(desc(sessions.startedAt))
      .limit(1),
  );
  const { data: recent } = useLiveQuery(
    db
      .select()
      .from(sessions)
      .where(and(isNotNull(sessions.finishedAt), isNull(sessions.deletedAt)))
      .orderBy(desc(sessions.startedAt))
      .limit(5),
  );
  const { data: myWorkouts } = useLiveQuery(
    db.select().from(workouts).where(isNull(workouts.deletedAt)).orderBy(desc(workouts.updatedAt)).limit(6),
  );

  const current = active[0];
  const thisWeek = recent.filter((s) => s.startedAt > weekAgo).length;

  return (
    <View style={styles.flex}>
      <Appbar.Header>
        <Appbar.Content title="RepTile" />
        <Appbar.Action icon="cog-outline" accessibilityLabel="Ajustes" onPress={() => router.push('/settings')} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
        {current && (
          <Card mode="contained" style={{ backgroundColor: theme.colors.primaryContainer }}>
            <Card.Title
              title="Treino em andamento"
              subtitle={current.name}
              left={(p) => <List.Icon {...p} icon="run-fast" />}
            />
            <Card.Actions>
              <Button
                mode="contained"
                icon="play"
                onPress={() => router.push({ pathname: '/session/[id]', params: { id: current.id } })}>
                Retomar
              </Button>
            </Card.Actions>
          </Card>
        )}

        <Card mode="outlined">
          <List.Item
            title={currentLocation?.name ?? 'Onde você treina?'}
            description={currentLocation ? `Local atual · ${LOCATION_KIND_LABEL[currentLocation.kind]}` : 'Cadastre sua academia ou box'}
            left={(p) => <List.Icon {...p} icon="map-marker-outline" color={theme.colors.primary} />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push('/locations')}
          />
        </Card>

        <Text variant="titleMedium">Começar um treino</Text>
        {myWorkouts.length === 0 ? (
          <Card mode="outlined">
            <Card.Content style={styles.emptyCard}>
              <Text variant="bodyMedium">Cadastre seu primeiro treino de musculação ou WOD.</Text>
              <Button mode="contained" icon="plus" onPress={() => router.push('/workout/edit')}>
                Criar treino
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <Card mode="contained">
            {myWorkouts.map((w, i) => (
              <View key={w.id}>
                {i > 0 && <Divider />}
                <List.Item
                  title={w.name}
                  description={WORKOUT_TYPE_LABEL[w.type]}
                  left={(p) => <List.Icon {...p} icon={WORKOUT_TYPE_ICON[w.type]} />}
                  right={(p) => <List.Icon {...p} icon="chevron-right" />}
                  onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
                />
              </View>
            ))}
          </Card>
        )}

        {recent.length > 0 && (
          <>
            <Text variant="titleMedium">
              Recentes {thisWeek > 0 ? `· ${thisWeek} na última semana` : ''}
            </Text>
            <Card mode="outlined">
              {recent.map((s, i) => (
                <View key={s.id}>
                  {i > 0 && <Divider />}
                  <List.Item
                    title={s.name}
                    description={[formatDate(s.startedAt), describeResult(s)].filter(Boolean).join(' · ')}
                    left={(p) => <List.Icon {...p} icon={WORKOUT_TYPE_ICON[s.type]} />}
                    onPress={() => router.push({ pathname: '/history/[id]', params: { id: s.id } })}
                  />
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  emptyCard: { gap: 12, alignItems: 'flex-start' },
});
