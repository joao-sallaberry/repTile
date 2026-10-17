import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useKeepAwake } from 'expo-keep-awake';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ColorValue } from 'react-native';
import { Button, Card, Divider, IconButton, List, ProgressBar, Switch, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DurationField } from '@/components/duration-field';
import { NumberField } from '@/components/number-field';
import { db } from '@/db/client';
import { sessionSets, type SessionBlock, type SessionSet } from '@/db/schema';
import { computeTimer } from '@/features/timer/engine';
import { startTimer } from '@/features/timer/start';
import { useTimerStore, type ActiveTimer } from '@/features/timer/store';
import { useTimerSnapshot } from '@/features/timer/use-timer-snapshot';
import {
  blockTimerSpec,
  describeBlockFormat,
  emomMovementIndex,
  splitDurations,
  tabataMovementIndex,
  worstRound,
} from '@/features/workouts/blocks';
import { describeItem } from '@/features/workouts/describe';
import { useExerciseMap } from '@/features/workouts/queries';
import { formatDuration, formatWeight } from '@/lib/format';

import { updateWodProgress, type BlockResult } from './repo';

const LEAD_IN_SEC = 10;

/** Starts a WOD block's timer (with the lead-in); the block's card calls it before opening `wod/[id]`. */
export function startBlockTimer(block: SessionBlock) {
  startTimer({
    sessionId: block.sessionId,
    blockId: block.id,
    label: describeBlockFormat(block) ?? '',
    spec: blockTimerSpec(block),
    leadInSec: LEAD_IN_SEC,
  });
}

type Snap = NonNullable<ReturnType<typeof useTimerSnapshot>>;

/** Colors of the screen; Tabata swaps them with the phase so work and rest show from afar. */
type Palette = { bg: string; fg: string; muted: string; card: string; track: string; accent: string; onAccent: string };

const TRACK = '#2A2E36';
const TABATA_WORK: Palette = {
  bg: '#FF7A1A',
  fg: '#1A0B00',
  muted: 'rgba(26, 11, 0, 0.75)',
  card: 'rgba(26, 11, 0, 0.12)',
  track: 'rgba(26, 11, 0, 0.2)',
  accent: '#1A0B00',
  onAccent: '#FF7A1A',
};
const TABATA_REST: Palette = {
  bg: '#0E2A47',
  fg: '#D6EBFF',
  muted: 'rgba(214, 235, 255, 0.75)',
  card: 'rgba(214, 235, 255, 0.08)',
  track: 'rgba(214, 235, 255, 0.18)',
  accent: '#D6EBFF',
  onAccent: '#0E2A47',
};

function usePalette(): Palette {
  const theme = useTheme();
  return {
    bg: theme.colors.background,
    fg: theme.colors.onSurface,
    muted: theme.colors.onSurfaceVariant,
    card: theme.colors.elevation.level2,
    track: TRACK,
    accent: theme.colors.primary,
    onAccent: theme.colors.onPrimary,
  };
}

type Props = {
  block: SessionBlock;
  /** Second header line, e.g. "Treino A · bloco 2 de 3". */
  subtitle: string;
  onClose: () => void;
  onSave: (result: BlockResult) => void;
};

/**
 * Runs one WOD block of a session, full screen: lead-in, the timer of its kind, round tracking and the result.
 * Opened without a running timer (the card's "Registrar sem timer"), it goes straight to the result form.
 */
export function WodRunner({ block, subtitle, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const base = usePalette();
  const active = useTimerStore((s) => s.active);
  const timer = active && active.blockId === block.id ? active : null;
  const snap = useTimerSnapshot(timer);
  const [finishedTimeSec, setFinishedTimeSec] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const movements = useMovements(block.id);
  const format = describeBlockFormat(block) ?? '';

  const end = (timeSec: number | null = null) => {
    setFinishedTimeSec(timeSec);
    useTimerStore.getState().pause();
    setShowResult(true);
  };

  const timerDone = snap?.phase === 'done';
  const resultVisible = showResult || timerDone || !timer;
  const running = !!timer && !!snap && !resultVisible;
  const palette =
    running && block.kind === 'tabata' && snap.phase === 'running'
      ? snap.interval === 'rest'
        ? TABATA_REST
        : TABATA_WORK
      : base;

  return (
    <View style={[styles.flex, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <Header title={format} subtitle={subtitle} color={palette.fg} muted={palette.muted} onClose={onClose} />
      {timer && !snap ? null : running ? (
        <RunningView block={block} timer={timer} snap={snap} movements={movements} palette={palette} onEnd={end} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {resultVisible ? (
            <ResultForm
              block={block}
              initialTimeSec={finishedTimeSec}
              timeCapped={timerDone && block.kind === 'for_time'}
              onCancel={
                timerDone || !timer
                  ? undefined
                  : () => {
                      setShowResult(false);
                      useTimerStore.getState().resume();
                    }
              }
              onSave={(r) => {
                // Only this block's timer: a rest timer of another exercise keeps running.
                if (timer) useTimerStore.getState().stop();
                onSave(r);
              }}
            />
          ) : null}
          <Movements block={block} movements={movements} />
        </ScrollView>
      )}
    </View>
  );
}

function useMovements(blockId: string) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(sessionSets)
      .where(and(eq(sessionSets.sessionBlockId, blockId), isNull(sessionSets.deletedAt)))
      .orderBy(asc(sessionSets.position)),
    [blockId],
  );
  return data;
}

function Header({
  title,
  subtitle,
  color,
  muted,
  onClose,
}: {
  title: string;
  subtitle: string;
  color: string;
  muted: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.header}>
      <IconButton icon="chevron-down" iconColor={color} accessibilityLabel="Voltar ao treino" onPress={onClose} />
      <View style={styles.headerText}>
        <Text variant="titleMedium" style={{ color }} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodySmall" style={{ color: muted }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

type RunningProps = {
  block: SessionBlock;
  timer: ActiveTimer;
  snap: Snap;
  movements: SessionSet[];
  palette: Palette;
  onEnd: (timeSec?: number | null) => void;
};

function RunningView(props: RunningProps) {
  useKeepAwake();
  if (props.snap.phase === 'lead_in') return <LeadIn {...props} />;
  switch (props.block.kind) {
    case 'emom':
      return <EmomView {...props} />;
    case 'amrap':
      return <AmrapView {...props} />;
    case 'tabata':
      return <TabataView {...props} />;
    default:
      return <ForTimeView {...props} />;
  }
}

/** Work seconds elapsed right now (fresher than the last snapshot). */
const elapsedNow = (timer: ActiveTimer) => Math.round(computeTimer(timer.spec, timer.clock, Date.now()).elapsedSec);

/** "12 Burpees · 24 kg", "Corrida · 400 m". */
function useMovementText() {
  const exerciseMap = useExerciseMap();
  return (m: SessionSet) => {
    const name = exerciseMap.get(m.exerciseId)?.name ?? '—';
    const weight = m.weight ? ` · ${formatWeight(m.weight)}` : '';
    if (m.reps != null) return `${m.reps} ${name}${weight}`;
    const amount = describeItem({ ...m, weight: null }, 'amrap');
    return `${name}${amount ? ` · ${amount}` : ''}${weight}`;
  };
}

function LeadIn({ block, timer, snap, movements, palette }: RunningProps) {
  const text = useMovementText();
  const first = block.kind === 'tabata' || block.alternate ? movements[0] : undefined;
  return (
    <View style={styles.flex}>
      <View style={styles.centerFill}>
        <Text variant="titleMedium" style={[styles.caps, { color: palette.accent }]}>
          PREPARE-SE
        </Text>
        <Text style={[styles.giant, { color: palette.fg }]}>{snap.displaySec}</Text>
        {first && (
          <Text variant="titleLarge" style={[styles.center, { color: palette.muted }]}>
            Primeiro: {text(first)}
          </Text>
        )}
      </View>
      <Controls
        timer={timer}
        palette={palette}
        right={<OutlineButton label="Pular" color={palette.fg} onPress={useTimerStore.getState().skip} />}
      />
    </View>
  );
}

function EmomView({ block, timer, snap, movements, palette, onEnd }: RunningProps) {
  const text = useMovementText();
  const interval = block.intervalSec ?? 60;
  const round = snap.round ?? 1;
  const count = snap.roundCount ?? 1;
  const unit = interval === 60 ? 'Minuto' : 'Intervalo';
  const idx = emomMovementIndex(round, movements.length, block.alternate);
  const now = idx != null ? movements[idx] : undefined;
  const next = idx != null && round < count && movements.length > 1 ? movements[(idx + 1) % movements.length] : undefined;
  const fraction = (snap.roundRemainingSec ?? 0) / interval;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.running}>
        <View style={styles.rowBetween}>
          <Text variant="titleLarge" style={{ color: palette.fg }}>
            {unit} {round} <Text style={{ color: palette.muted }}>de {count}</Text>
          </Text>
          <Text variant="bodyMedium" style={[styles.num, { color: palette.muted }]}>
            {formatDuration(snap.elapsedSec)} / {formatDuration(snap.totalSec ?? 0)}
          </Text>
        </View>
        <Segments count={count} done={round - 1} palette={palette} />
        <Dial size={260} fraction={fraction} color={palette.accent} track={palette.track}>
          <Text
            style={[styles.huge, { color: palette.fg }]}
            accessibilityRole="timer"
            accessibilityLabel={`${snap.displaySec} segundos restantes no intervalo`}>
            {formatDuration(snap.displaySec)}
          </Text>
          <Text variant="bodyMedium" style={{ color: palette.muted }}>
            {round === count ? 'até o fim' : interval === 60 ? 'até o próximo minuto' : 'até o próximo intervalo'}
          </Text>
        </Dial>
        {now ? (
          <View style={styles.gap8}>
            <View style={[styles.nowCard, { backgroundColor: palette.accent }]}>
              <Letter index={idx ?? 0} bg={palette.onAccent} fg={palette.accent} size={44} />
              <View style={styles.flex}>
                <Text variant="labelMedium" style={[styles.caps, { color: palette.onAccent }]}>
                  AGORA
                </Text>
                <Text variant="headlineSmall" style={[styles.bold, { color: palette.onAccent }]}>
                  {text(now)}
                </Text>
              </View>
            </View>
            {next && (
              <View style={[styles.nextCard, { backgroundColor: palette.card }]}>
                <Letter index={(idx! + 1) % movements.length} bg={palette.track} fg={palette.fg} size={32} />
                <View style={styles.flex}>
                  <Text variant="bodySmall" style={{ color: palette.muted }}>
                    {interval === 60 ? 'Próximo minuto' : 'Próximo intervalo'}
                  </Text>
                  <Text variant="titleMedium" style={{ color: palette.fg }}>
                    {text(next)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <MovementCard title={interval === 60 ? 'TODO MINUTO' : 'TODO INTERVALO'} movements={movements} palette={palette} text={text} />
        )}
      </ScrollView>
      <Controls
        timer={timer}
        palette={palette}
        left={<OutlineButton label="Encerrar" color={palette.fg} onPress={() => onEnd()} />}
        right={
          <OutlineButton
            label="Pular"
            color={palette.fg}
            accessibilityLabel={`Pular para o próximo ${unit.toLowerCase()}`}
            disabled={round === count}
            onPress={useTimerStore.getState().skip}
          />
        }
      />
    </View>
  );
}

function AmrapView({ block, timer, snap, movements, palette, onEnd }: RunningProps) {
  const theme = useTheme();
  const text = useMovementText();
  const splits = block.roundSplits ?? [];
  const rounds = splits.length;
  const durations = splitDurations(splits);
  const setSplits = (next: number[]) => updateWodProgress(block.id, { roundSplits: next, resultRounds: next.length });

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.running}>
        <View style={styles.centerBlock}>
          <Text
            style={[styles.huge, { color: palette.fg }]}
            accessibilityRole="timer"
            accessibilityLabel={`${formatDuration(snap.displaySec)} restantes`}>
            {formatDuration(snap.displaySec)}
          </Text>
          <Text variant="bodyMedium" style={{ color: palette.muted }}>
            restantes · {formatDuration(snap.elapsedSec)} feitos
          </Text>
          <ProgressBar progress={snap.progress ?? 0} color={palette.accent} style={[styles.bar, { backgroundColor: palette.track }]} />
        </View>

        <View style={styles.roundsRow}>
          <View style={[styles.roundsCard, { backgroundColor: palette.card }]}>
            <Text variant="labelMedium" style={[styles.caps, { color: palette.muted }]}>
              ROUNDS
            </Text>
            <Text style={[styles.count, { color: palette.fg }]}>{rounds}</Text>
            <Text variant="bodySmall" style={{ color: palette.muted }}>
              {rounds
                ? `média ${formatDuration(splits[rounds - 1] / rounds)} · último ${formatDuration(durations[rounds - 1])}`
                : 'toque em + Round ao fechar cada um'}
            </Text>
          </View>
          <View style={styles.roundButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mais um round"
              onPress={() => setSplits([...splits, elapsedNow(timer)])}
              style={({ pressed }) => [styles.plusRound, { backgroundColor: palette.accent, opacity: pressed ? 0.8 : 1 }]}>
              <Text variant="titleLarge" style={[styles.bold, { color: palette.onAccent }]}>
                + Round
              </Text>
            </Pressable>
            <Button
              mode="outlined"
              disabled={!rounds}
              textColor={theme.colors.onSurfaceVariant}
              accessibilityLabel="Desfazer último round"
              onPress={() => setSplits(splits.slice(0, -1))}>
              Desfazer
            </Button>
          </View>
        </View>

        <MovementCard title="CADA ROUND" movements={movements} palette={palette} text={text} />
      </ScrollView>
      <Controls timer={timer} palette={palette} left={<OutlineButton label="Encerrar" color={palette.fg} onPress={() => onEnd()} />} />
    </View>
  );
}

function ForTimeView({ block, timer, snap, movements, palette, onEnd }: RunningProps) {
  const total = Math.max(1, block.rounds ?? 1);
  const splits = block.roundSplits ?? [];
  const current = Math.min(splits.length + 1, total);
  const inRound = snap.elapsedSec - (splits.at(-1) ?? 0);
  const cap = block.timeCapSec;
  const lastRound = splits.length >= total - 1;

  const roundDone = () => {
    const next = [...splits, elapsedNow(timer)];
    void updateWodProgress(block.id, { roundSplits: next });
  };
  const finish = () => {
    const at = elapsedNow(timer);
    if (splits.length < total) void updateWodProgress(block.id, { roundSplits: [...splits, at] });
    onEnd(at);
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.running}>
        <View style={styles.centerBlock}>
          <Text
            style={[styles.huge, { color: palette.fg }]}
            accessibilityRole="timer"
            accessibilityLabel={`${formatDuration(snap.displaySec)} decorridos`}>
            {formatDuration(snap.displaySec)}
          </Text>
          <Text variant="bodyMedium" style={{ color: palette.muted }}>
            {cap ? `${formatDuration(cap - snap.elapsedSec)} até o cap` : 'sem time cap'}
          </Text>
          {cap ? (
            <View style={styles.capBar}>
              <ProgressBar progress={snap.progress ?? 0} color={palette.accent} style={[styles.bar, { backgroundColor: palette.track }]} />
              <View style={[styles.capMark, { backgroundColor: palette.fg }]} />
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card }]}>
          {total > 1 && (
            <>
              <View style={styles.rowBetween}>
                <Text variant="titleLarge" style={[styles.bold, { color: palette.fg }]}>
                  Round {current} <Text style={{ color: palette.muted }}>de {total}</Text>
                </Text>
                <Text variant="bodySmall" style={[styles.num, { color: palette.muted }]}>
                  neste round {formatDuration(inRound)}
                </Text>
              </View>
              <Segments count={total} done={splits.length} palette={palette} />
            </>
          )}
          {movements.map((m) => (
            <MovementRow key={m.id} movement={m} palette={palette} />
          ))}
        </View>

        {splits.length > 0 && (
          <View style={styles.splits}>
            <Text variant="labelMedium" style={[styles.caps, { color: palette.muted }]}>
              PARCIAIS
            </Text>
            {splitDurations(splits).map((d, i) => (
              <View key={i} style={styles.rowBetween}>
                <Text variant="bodyMedium" style={{ color: palette.fg }}>
                  Round {i + 1}
                </Text>
                <Text variant="bodyMedium" style={[styles.num, { color: palette.fg }]}>
                  {formatDuration(d)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.forTimeBar}>
        <View style={styles.row}>
          {lastRound ? (
            <BigButton label={`Terminei · ${formatDuration(snap.elapsedSec)}`} palette={palette} onPress={finish} />
          ) : (
            <BigButton label="Round feito" palette={palette} onPress={roundDone} />
          )}
          <PauseButton timer={timer} palette={palette} size={64} square />
        </View>
        {!lastRound && (
          <Button mode="outlined" textColor={palette.fg} contentStyle={styles.outlineContent} onPress={finish}>
            Terminei · parar em {formatDuration(snap.elapsedSec)}
          </Button>
        )}
      </View>
    </View>
  );
}

function TabataView({ block, timer, snap, movements, palette, onEnd }: RunningProps) {
  const text = useMovementText();
  const round = snap.round ?? 1;
  const count = snap.roundCount ?? 1;
  const work = snap.interval !== 'rest';
  const reps = block.roundReps ?? [];
  const repsNow = reps[round - 1] ?? 0;
  const completed = work ? round - 1 : round;
  const worst = worstRound(Array.from({ length: completed }, (_, i) => reps[i] ?? 0));
  const idx = tabataMovementIndex(round, movements.length);
  const nextIdx = tabataMovementIndex(round + 1, movements.length);
  const shown = work ? (idx != null ? movements[idx] : undefined) : nextIdx != null ? movements[nextIdx] : undefined;
  const after = work && round < count && nextIdx != null ? movements[nextIdx] : undefined;
  const name = (m: SessionSet | undefined) => (m ? text({ ...m, reps: null, weight: m.weight }) : '');

  const changeReps = (delta: number) => {
    const next = Array.from({ length: Math.max(reps.length, round) }, (_, i) => reps[i] ?? 0);
    next[round - 1] = Math.max(0, next[round - 1] + delta);
    void updateWodProgress(block.id, { roundReps: next, resultReps: next.reduce((a, b) => a + b, 0) });
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.running}>
        <View style={styles.rowBetween}>
          <Text variant="titleLarge" style={{ color: palette.fg }}>
            Round {round} <Text style={{ color: palette.muted }}>de {count}</Text>
          </Text>
          <Text variant="bodyMedium" style={[styles.num, { color: palette.muted }]}>
            restam {formatDuration((snap.totalSec ?? 0) - snap.elapsedSec)}
          </Text>
        </View>
        <Segments count={count} done={round - 1} palette={palette} />

        <View style={styles.centerBlock}>
          <Text variant="titleMedium" style={[styles.phase, { color: palette.fg }]}>
            {work ? 'TRABALHO' : 'DESCANSO'}
          </Text>
          <Text
            style={[styles.giant, { color: palette.fg }]}
            accessibilityRole="timer"
            accessibilityLabel={`${snap.displaySec} segundos de ${work ? 'trabalho' : 'descanso'}`}>
            {snap.displaySec < 60 ? String(snap.displaySec).padStart(2, '0') : formatDuration(snap.displaySec)}
          </Text>
        </View>

        {shown && (
          <View style={[styles.tabataCard, { backgroundColor: palette.card }]}>
            <Text variant="labelMedium" style={[styles.caps, { color: palette.muted }]}>
              {work ? 'AGORA' : 'PRÓXIMO'}
            </Text>
            <Text variant="headlineMedium" style={[styles.bold, styles.center, { color: palette.fg }]}>
              {name(shown)}
            </Text>
            {(after || !work) && (
              <Text variant="bodyMedium" style={{ color: palette.muted }}>
                {after ? `depois: ${name(after)} · round ${round + 1}` : `round ${round + 1}`}
              </Text>
            )}
          </View>
        )}

        <View style={styles.repsBox}>
          <View style={styles.rowBetween}>
            <Text variant="labelMedium" style={[styles.caps, { color: palette.muted }]}>
              {work ? 'REPS NESTE ROUND' : `REPS NO ROUND ${round}`}
            </Text>
            <Text style={[styles.count, { color: palette.fg }]}>{repsNow}</Text>
          </View>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menos uma rep"
              disabled={repsNow === 0}
              onPress={() => changeReps(-1)}
              style={[styles.minusRep, { borderColor: palette.fg, opacity: repsNow === 0 ? 0.4 : 1 }]}>
              <Text variant="headlineSmall" style={[styles.bold, { color: palette.fg }]}>
                −
              </Text>
            </Pressable>
            {[1, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={n === 1 ? 'Mais uma rep' : `Mais ${n} reps`}
                onPress={() => changeReps(n)}
                style={({ pressed }) => [styles.plusRep, { backgroundColor: palette.accent, opacity: pressed ? 0.8 : 1 }]}>
                <Text variant="titleLarge" style={[styles.bold, { color: palette.onAccent }]}>
                  +{n} {n === 1 ? 'rep' : 'reps'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
      <Controls
        timer={timer}
        palette={palette}
        left={<OutlineButton label="Encerrar" color={palette.fg} onPress={() => onEnd()} />}
        right={
          <Text variant="bodySmall" style={[styles.worst, { color: palette.muted }]}>
            {worst != null ? `pior round: ${worst}` : ''}
          </Text>
        }
      />
    </View>
  );
}

// --- Building blocks ---------------------------------------------------------

/** One bar per round/interval: done, current (lighter) and to come. */
function Segments({ count, done, palette }: { count: number; done: number; palette: Palette }) {
  return (
    <View style={[styles.segments, { gap: count > 20 ? 2 : 4 }]} accessible={false}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            { backgroundColor: i < done ? palette.accent : palette.track },
            i === done && { backgroundColor: palette.accent, opacity: 0.55 },
          ]}
        />
      ))}
    </View>
  );
}

const DIAL_TICKS = 60;

/** Watch-like dial of 60 ticks; the lit ones (clockwise from the top) show the time left. */
function Dial({
  size,
  fraction,
  color,
  track,
  children,
}: {
  size: number;
  fraction: number;
  color: ColorValue;
  track: ColorValue;
  children: ReactNode;
}) {
  const lit = Math.round(Math.max(0, Math.min(1, fraction)) * DIAL_TICKS);
  const box = { position: 'absolute' as const, left: 0, top: 0, width: size, height: size };
  return (
    <View style={[styles.dial, { width: size, height: size }]}>
      {Array.from({ length: DIAL_TICKS }, (_, i) => (
        <View key={i} style={[box, styles.tickBox, { transform: [{ rotate: `${i * 6}deg` }] }]}>
          <View style={[styles.tick, { backgroundColor: i < lit ? color : track }]} />
        </View>
      ))}
      <View style={[box, styles.dialCenter]}>{children}</View>
    </View>
  );
}

function Letter({ index, bg, fg, size }: { index: number; bg: string; fg: string; size: number }) {
  return (
    <View style={[styles.letter, { width: size, height: size, borderRadius: size / 3, backgroundColor: bg }]}>
      <Text style={[styles.bold, { color: fg, fontSize: size * 0.45 }]}>{String.fromCharCode(65 + (index % 26))}</Text>
    </View>
  );
}

function MovementCard({
  title,
  movements,
  palette,
  text,
}: {
  title: string;
  movements: SessionSet[];
  palette: Palette;
  text: (m: SessionSet) => string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: palette.card }]}>
      <Text variant="labelMedium" style={[styles.caps, { color: palette.accent }]}>
        {title}
      </Text>
      {movements.map((m) =>
        title === 'CADA ROUND' ? (
          <MovementRow key={m.id} movement={m} palette={palette} />
        ) : (
          <Text key={m.id} variant="titleMedium" style={{ color: palette.fg }}>
            {text(m)}
          </Text>
        ),
      )}
    </View>
  );
}

/** "Pull-ups ........ 5" */
function MovementRow({ movement: m, palette }: { movement: SessionSet; palette: Palette }) {
  const exerciseMap = useExerciseMap();
  const name = exerciseMap.get(m.exerciseId)?.name ?? '—';
  const amount = m.reps != null ? String(m.reps) : describeItem({ ...m, weight: null }, 'amrap');
  return (
    <View style={styles.rowBetween}>
      <Text variant="titleMedium" style={[styles.flex, { color: palette.fg }]}>
        {name}
        {m.weight ? ` · ${formatWeight(m.weight)}` : ''}
      </Text>
      <Text variant="titleMedium" style={[styles.num, { color: palette.fg }]}>
        {amount}
      </Text>
    </View>
  );
}

function Controls({ timer, palette, left, right }: { timer: ActiveTimer; palette: Palette; left?: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.controls}>
      <View style={[styles.side, styles.sideLeft]}>{left}</View>
      <PauseButton timer={timer} palette={palette} size={76} />
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

function PauseButton({ timer, palette, size, square }: { timer: ActiveTimer; palette: Palette; size: number; square?: boolean }) {
  const paused = timer.clock.pausedAt != null;
  return (
    <IconButton
      icon={paused ? 'play' : 'pause'}
      mode="contained"
      size={size * 0.4}
      containerColor={palette.fg}
      iconColor={palette.bg}
      accessibilityLabel={paused ? 'Retomar' : 'Pausar'}
      style={[styles.noMargin, { width: size, height: size, borderRadius: square ? 20 : size / 2 }]}
      onPress={useTimerStore.getState().togglePause}
    />
  );
}

function OutlineButton({
  label,
  color,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Button
      mode="outlined"
      textColor={color}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      contentStyle={styles.outlineContent}
      style={styles.outline}
      onPress={onPress}>
      {label}
    </Button>
  );
}

function BigButton({ label, palette, onPress }: { label: string; palette: Palette; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.bigButton, { backgroundColor: palette.accent, opacity: pressed ? 0.8 : 1 }]}>
      <Text variant="titleLarge" style={[styles.bold, { color: palette.onAccent }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// --- Result ------------------------------------------------------------------

function ResultForm({
  block,
  initialTimeSec,
  timeCapped,
  onCancel,
  onSave,
}: {
  block: SessionBlock;
  initialTimeSec: number | null;
  timeCapped: boolean;
  onCancel?: () => void;
  onSave: (r: BlockResult) => void;
}) {
  const splitsCount = block.roundSplits?.length ?? 0;
  // Tabata: one editable field per round, pre-filled with what was counted during the timer.
  const [roundReps, setRoundReps] = useState<(number | null)[]>(() =>
    Array.from({ length: Math.max(block.rounds ?? 0, block.roundReps?.length ?? 0) }, (_, i) => block.roundReps?.[i] ?? null),
  );
  const filled = roundReps.filter((r): r is number => r != null);
  const tabataTotal = filled.length ? filled.reduce((a, b) => a + b, 0) : null;
  const worst = worstRound(filled);
  const [timeSec, setTimeSec] = useState<number | null>(timeCapped ? null : initialTimeSec);
  const [rounds, setRounds] = useState<number | null>(
    block.kind === 'emom' ? block.rounds : (block.resultRounds ?? (splitsCount || null)),
  );
  const [reps, setReps] = useState<number | null>(block.resultReps ?? null);
  const [rx, setRx] = useState(true);

  const save = () =>
    onSave(
      block.kind === 'tabata'
        ? { resultRounds: null, resultReps: tabataTotal, roundReps: roundReps.map((r) => r ?? 0), rx }
        : {
            resultTimeSec: block.kind === 'for_time' && !timeCapped ? timeSec : null,
            resultRounds: rounds,
            resultReps: block.kind === 'emom' ? null : reps,
            rx,
          },
    );

  return (
    <Card mode="contained">
      <Card.Title title={timeCapped ? 'Time cap! Registre até onde chegou' : 'Resultado'} />
      <Card.Content style={styles.form}>
        {block.kind === 'for_time' && !timeCapped && (
          <DurationField label="Tempo final (m:ss)" value={timeSec} onChange={setTimeSec} />
        )}
        {(block.kind === 'amrap' || timeCapped) && (
          <View style={styles.row}>
            <NumberField style={styles.flex} label="Rounds" value={rounds} onChange={setRounds} />
            <NumberField style={styles.flex} label="Reps extras" value={reps} onChange={setReps} />
          </View>
        )}
        {block.kind === 'emom' && <NumberField label="Intervalos completos" value={rounds} onChange={setRounds} />}
        {block.kind === 'tabata' && (
          <>
            <Text variant="labelLarge">Reps por round</Text>
            <View style={styles.roundGrid}>
              {roundReps.map((r, i) => (
                <NumberField
                  key={i}
                  label={`Round ${i + 1}`}
                  value={r}
                  style={styles.roundField}
                  onChange={(v) => setRoundReps(roundReps.map((x, j) => (j === i ? v : x)))}
                />
              ))}
            </View>
            <Text variant="titleMedium">
              Total: {tabataTotal ?? 0} reps{worst != null ? ` · pior round ${worst}` : ''}
            </Text>
          </>
        )}
        {(block.kind === 'amrap' || block.kind === 'for_time') && splitsCount > 0 && (
          <Text variant="bodyMedium" style={styles.muted}>
            Parciais: {splitDurations(block.roundSplits!).map(formatDuration).join(' · ')}
          </Text>
        )}
        <View style={styles.rxRow}>
          <Text variant="bodyLarge">Rx (sem adaptação)</Text>
          <Switch value={rx} onValueChange={setRx} />
        </View>
      </Card.Content>
      <Card.Actions>
        {onCancel && <Button onPress={onCancel}>Voltar ao timer</Button>}
        <Button mode="contained" onPress={save}>
          Salvar resultado
        </Button>
      </Card.Actions>
    </Card>
  );
}

function Movements({ block, movements }: { block: SessionBlock; movements: SessionSet[] }) {
  const exerciseMap = useExerciseMap();
  const subtitle = block.alternate
    ? 'Um movimento por intervalo, em sequência'
    : block.kind === 'tabata' && movements.length > 1
      ? 'Um movimento por round, em sequência'
      : undefined;
  return (
    <Card mode="outlined">
      <Card.Title title={describeBlockFormat(block)} subtitle={subtitle} />
      {movements.map((s, i) => (
        <View key={s.id}>
          {i > 0 && <Divider />}
          <List.Item
            title={`${block.alternate || block.kind === 'tabata' ? `${String.fromCharCode(65 + (i % 26))}. ` : ''}${exerciseMap.get(s.exerciseId)?.name ?? '—'}`}
            description={describeItem(s, block.kind) || undefined}
          />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  gap8: { gap: 8 },
  center: { textAlign: 'center' },
  bold: { fontWeight: '700' },
  caps: { letterSpacing: 0.8, fontWeight: '700' },
  num: { fontVariant: ['tabular-nums'] },
  muted: { opacity: 0.75 },
  noMargin: { margin: 0 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingTop: 4 },
  headerText: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 48 },

  content: { padding: 12, gap: 12, paddingBottom: 48 },
  running: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 16 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  centerBlock: { alignItems: 'center', gap: 6 },

  giant: { fontSize: 150, lineHeight: 160, fontWeight: '700', fontVariant: ['tabular-nums'] },
  huge: { fontSize: 84, lineHeight: 96, fontWeight: '700', fontVariant: ['tabular-nums'] },
  count: { fontSize: 52, lineHeight: 60, fontWeight: '700', fontVariant: ['tabular-nums'] },
  phase: { letterSpacing: 2.4, fontWeight: '700' },

  segments: { flexDirection: 'row' },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  bar: { height: 8, borderRadius: 4, width: '100%' },
  capBar: { alignSelf: 'stretch', justifyContent: 'center' },
  capMark: { position: 'absolute', right: 0, width: 3, height: 16, borderRadius: 2 },

  dial: { alignSelf: 'center' },
  tickBox: { alignItems: 'center' },
  tick: { width: 4, height: 18, borderRadius: 2 },
  dialCenter: { alignItems: 'center', justifyContent: 'center' },

  nowCard: { borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  nextCard: { borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  letter: { alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 22, padding: 16, gap: 10 },

  roundsRow: { flexDirection: 'row', gap: 8 },
  roundsCard: { flex: 1, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 18, gap: 2, justifyContent: 'center' },
  roundButtons: { width: 140, gap: 8 },
  plusRound: { flex: 1, minHeight: 88, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  splits: { gap: 6, paddingHorizontal: 8 },
  forTimeBar: { paddingHorizontal: 12, paddingBottom: 16, gap: 12 },
  bigButton: { flex: 1, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  tabataCard: { borderRadius: 22, padding: 16, gap: 4, alignItems: 'center' },
  repsBox: { gap: 8 },
  minusRep: { width: 56, height: 56, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  plusRep: { flex: 1, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  worst: { textAlign: 'right' },

  controls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 16 },
  side: { flex: 1 },
  sideLeft: { alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  outline: { borderRadius: 16 },
  outlineContent: { height: 52 },

  form: { gap: 12 },
  roundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roundField: { width: '23%', flexGrow: 1 },
  rxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
