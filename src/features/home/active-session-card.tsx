import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Icon, ProgressBar, Text, useTheme } from 'react-native-paper';

import { db } from '@/db/client';
import { sessionSets, type Session } from '@/db/schema';
import { useTimerStore } from '@/features/timer/store';
import { useTimerSnapshot } from '@/features/timer/use-timer-snapshot';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatDuration } from '@/lib/format';
import { WORKOUT_TYPE_LABEL } from '@/theme';

function useElapsedSec(since: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.floor((now - since) / 1000));
}

/** The session in progress: elapsed time, progress, current exercise and the running timer. */
export function ActiveSessionCard({ session }: { session: Session }) {
  const theme = useTheme();
  const exerciseMap = useExerciseMap();
  const elapsed = useElapsedSec(session.startedAt);
  const active = useTimerStore((s) => s.active);
  const timer = active?.sessionId === session.id ? active : null;
  const snap = useTimerSnapshot(timer);

  const { data: sets } = useLiveQuery(
    db
      .select()
      .from(sessionSets)
      .where(and(eq(sessionSets.sessionId, session.id), isNull(sessionSets.deletedAt)))
      .orderBy(asc(sessionSets.position), asc(sessionSets.setIndex)),
    [session.id],
  );

  const isStrength = session.type === 'strength';
  const done = sets.filter((s) => s.completedAt).length;
  const current = sets.find((s) => !s.completedAt);
  const currentName = current ? exerciseMap.get(current.exerciseId)?.name : undefined;
  const timerRunning = timer && snap && snap.phase !== 'done';

  const progressText = isStrength
    ? sets.length
      ? `${done} de ${sets.length} séries${currentName ? ` · agora: ${currentName}` : ''}`
      : 'Nenhum exercício ainda'
    : session.type === 'amrap'
      ? `${WORKOUT_TYPE_LABEL.amrap} · ${session.resultRounds ?? 0} rounds + ${session.resultReps ?? 0} reps`
      : WORKOUT_TYPE_LABEL[session.type];

  const fg = theme.colors.onPrimary;
  return (
    <Card mode="contained" style={{ backgroundColor: theme.colors.primary }}>
      <Card.Content style={styles.content}>
        <View style={styles.row}>
          <View style={styles.live}>
            <View style={[styles.dot, { backgroundColor: fg }]} />
            <Text variant="labelMedium" style={[styles.caps, { color: fg }]}>
              TREINO EM ANDAMENTO
            </Text>
          </View>
          <Text variant="titleLarge" style={[styles.num, { color: fg }]}>
            {formatDuration(elapsed)}
          </Text>
        </View>
        <Text variant="headlineSmall" style={{ color: fg }}>
          {session.name}
        </Text>
        <View style={styles.progress}>
          {isStrength && sets.length > 0 && (
            <ProgressBar progress={done / sets.length} color={fg} style={[styles.bar, { backgroundColor: 'rgba(26,11,0,0.18)' }]} />
          )}
          <Text variant="labelLarge" style={{ color: fg }}>
            {progressText}
          </Text>
        </View>
        <View style={styles.row}>
          <Button
            mode="contained"
            icon="play"
            buttonColor={fg}
            textColor={theme.colors.onPrimaryContainer}
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
            style={styles.flex}
            contentStyle={styles.bigBtn}>
            Voltar ao treino
          </Button>
          {timerRunning && (
            <View
              style={[styles.timer, { borderColor: fg }]}
              accessible
              accessibilityLabel={`${timer.spec.kind === 'rest' ? 'Descanso' : 'Timer'}: ${formatDuration(snap.displaySec)}`}>
              <Icon source="timer-outline" size={16} color={fg} />
              <Text variant="titleSmall" style={[styles.num, { color: fg }]}>
                {formatDuration(snap.displaySec)}
              </Text>
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  caps: { letterSpacing: 0.6 },
  num: { fontVariant: ['tabular-nums'] },
  progress: { gap: 6 },
  bar: { height: 8, borderRadius: 4 },
  bigBtn: { height: 50 },
  timer: { height: 50, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
