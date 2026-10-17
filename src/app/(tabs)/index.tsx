import { and, desc, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';

import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { ActiveSessionCard } from '@/features/home/active-session-card';
import { FirstUse } from '@/features/home/first-use';
import { LocationChip } from '@/features/home/location-chip';
import { useRoutines } from '@/features/home/queries';
import { RecentPrs } from '@/features/home/recent-prs';
import { RecentSessions } from '@/features/home/recent-sessions';
import { RoutineList } from '@/features/home/routine-list';
import { StartSection } from '@/features/home/start-section';
import { WeekCard } from '@/features/home/week-card';

const todayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export default function HomeScreen() {
  // "Now" for relative dates and the week; refreshed whenever the tab gets focus.
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));

  const { data: active } = useLiveQuery(
    db
      .select()
      .from(sessions)
      .where(and(isNull(sessions.finishedAt), isNull(sessions.deletedAt)))
      .orderBy(desc(sessions.startedAt))
      .limit(1),
  );
  const { data: anySession } = useLiveQuery(
    db.select({ id: sessions.id }).from(sessions).where(isNull(sessions.deletedAt)).limit(1),
  );
  const routines = useRoutines();
  const current = active[0];
  const firstUse = !current && routines.length === 0 && anySession.length === 0;
  const today = todayFmt.format(now);

  return (
    <View style={styles.flex}>
      <Appbar.Header>
        <Appbar.Content
          title="RepTile"
          titleStyle={styles.appTitle}
        />
        <Appbar.Action icon="cog-outline" accessibilityLabel="Ajustes" onPress={() => router.push('/settings')} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <Text variant="bodyMedium" style={styles.muted}>
            {today.charAt(0).toUpperCase() + today.slice(1)}
          </Text>
          <LocationChip />
        </View>

        {firstUse ? (
          <FirstUse />
        ) : current ? (
          <>
            <ActiveSessionCard session={current} />
            <WeekCard now={now} compact />
            <RecentSessions limit={3} />
            <Text variant="bodySmall" style={[styles.muted, styles.center]}>
              Termine o treino atual para começar outro.
            </Text>
          </>
        ) : (
          <>
            <WeekCard now={now} />
            <StartSection routines={routines} now={now} />
            <RoutineList routines={routines} now={now} />
            <RecentPrs now={now} />
            <RecentSessions />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingTop: 0, gap: 20, paddingBottom: 32 },
  top: { gap: 10 },
  appTitle: { fontWeight: '700' },
  muted: { opacity: 0.7 },
  center: { textAlign: 'center' },
});
