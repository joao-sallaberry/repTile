import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  HelperText,
  IconButton,
  List,
  Menu,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import { BlockConfigFields } from '@/components/block-config-fields';
import { DurationField } from '@/components/duration-field';
import { ExercisePicker } from '@/components/exercise-picker';
import { LocationPicker } from '@/components/location-picker';
import { MachinePicker } from '@/components/machine-picker';
import { NumberField } from '@/components/number-field';
import { SetBadge } from '@/components/set-badge';
import { SetTypeDialog } from '@/components/set-type-dialog';
import type { BlockKind, Exercise, SetType } from '@/db/schema';
import { useLocation, useMachineMap } from '@/features/places/queries';
import { setLabels } from '@/features/session/sets';
import { BLOCK_KIND_ICON, BLOCK_KIND_LABEL, describeBlockFormat, WOD_KINDS } from '@/features/workouts/blocks';
import { useExerciseMap } from '@/features/workouts/queries';
import {
  emptyBlock,
  emptyItem,
  emptyWorkout,
  getWorkoutDraft,
  newSet,
  saveWorkout,
  type BlockDraft,
  type SetDraft,
  type WorkoutDraft,
  type WorkoutItemDraft,
} from '@/features/workouts/repo';

type ItemRef = { block: number; item: number };

function move<T>(list: T[], index: number, delta: number): T[] {
  const next = [...list];
  const [it] = next.splice(index, 1);
  next.splice(index + delta, 0, it);
  return next;
}

export default function EditWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [draft, setDraft] = useState<WorkoutDraft | null>(id ? null : emptyWorkout());
  const [pickerFor, setPickerFor] = useState<number | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [machineFor, setMachineFor] = useState<ItemRef | null>(null);
  const exerciseMap = useExerciseMap();
  const location = useLocation(draft?.locationId);
  const theme = useTheme();

  useEffect(() => {
    if (id) getWorkoutDraft(id).then(setDraft);
  }, [id]);

  if (!draft) return null;

  const update = (patch: Partial<WorkoutDraft>) => setDraft({ ...draft, ...patch });
  const updateBlock = (index: number, patch: Partial<BlockDraft>) =>
    update({ blocks: draft.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)) });
  const updateItem = ({ block, item }: ItemRef, patch: Partial<WorkoutItemDraft>) =>
    updateBlock(block, { items: draft.blocks[block].items.map((it, i) => (i === item ? { ...it, ...patch } : it)) });

  /** Adds an exercise: to the given block, or to a trailing exercises block (created if needed). */
  const addExercise = (exerciseId: string) => {
    if (typeof pickerFor === 'number') {
      const b = draft.blocks[pickerFor];
      updateBlock(pickerFor, { items: [...b.items, emptyItem(exerciseId, b.kind)] });
      return;
    }
    const last = draft.blocks.at(-1);
    if (last?.kind === 'exercises') {
      updateBlock(draft.blocks.length - 1, { items: [...last.items, emptyItem(exerciseId, 'exercises')] });
    } else {
      update({ blocks: [...draft.blocks, { ...emptyBlock('exercises'), items: [emptyItem(exerciseId, 'exercises')] }] });
    }
  };

  const addBlock = (kind: BlockKind) => {
    setBlockMenuOpen(false);
    update({ blocks: [...draft.blocks, emptyBlock(kind)] });
    setPickerFor(draft.blocks.length);
  };

  const errors = validate(draft);
  const save = async () => {
    setSaving(true);
    try {
      const savedId = await saveWorkout(id ?? null, cleanDraft(draft));
      if (id) router.back();
      else router.replace({ pathname: '/workout/[id]', params: { id: savedId } });
    } finally {
      setSaving(false);
    }
  };

  const machineItem = machineFor ? draft.blocks[machineFor.block]?.items[machineFor.item] : undefined;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <Stack.Screen
        options={{
          title: id ? 'Editar treino' : 'Novo treino',
          headerRight: () => (
            <Button mode="contained" onPress={save} disabled={errors.length > 0 || saving} loading={saving}>
              Salvar
            </Button>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput mode="outlined" label="Nome do treino" value={draft.name} onChangeText={(name) => update({ name })} />

        <TouchableRipple
          onPress={() => setLocationOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Local da rotina: ${location?.name ?? 'nenhum'}. Toque para trocar`}
          style={[styles.locationBtn, { backgroundColor: theme.colors.elevation.level2 }]}>
          <List.Item
            title={location?.name ?? 'Sem local fixo'}
            description={location ? 'Local da rotina' : 'Usa o local atual ao iniciar'}
            left={(p) => <List.Icon {...p} icon="map-marker-outline" color={theme.colors.primary} />}
            right={(p) => <List.Icon {...p} icon="chevron-down" />}
          />
        </TouchableRipple>

        <TextInput
          mode="outlined"
          label="Observações"
          multiline
          value={draft.notes ?? ''}
          onChangeText={(notes) => update({ notes: notes || null })}
        />

        {draft.blocks.map((block, bi) => (
          <BlockEditor
            key={block.id ?? `new-${bi}`}
            block={block}
            index={bi}
            count={draft.blocks.length}
            exerciseMap={exerciseMap}
            onChange={(patch) => updateBlock(bi, patch)}
            onMove={(delta) => update({ blocks: move(draft.blocks, bi, delta) })}
            onRemove={() => update({ blocks: draft.blocks.filter((_, i) => i !== bi) })}
            onAddItem={() => setPickerFor(bi)}
            onPickMachine={(item) => setMachineFor({ block: bi, item })}
          />
        ))}

        <View style={styles.row}>
          <Button icon="plus" mode="outlined" style={styles.flex} onPress={() => setPickerFor('new')}>
            Exercício
          </Button>
          <Menu
            visible={blockMenuOpen}
            onDismiss={() => setBlockMenuOpen(false)}
            anchor={
              <Button icon="plus-box-multiple-outline" mode="outlined" onPress={() => setBlockMenuOpen(true)}>
                Bloco
              </Button>
            }>
            {WOD_KINDS.map((k) => (
              <Menu.Item key={k} leadingIcon={BLOCK_KIND_ICON[k]} title={BLOCK_KIND_LABEL[k]} onPress={() => addBlock(k)} />
            ))}
          </Menu>
        </View>
        {errors.map((e) => (
          <HelperText key={e} type="info">
            {e}
          </HelperText>
        ))}
      </ScrollView>

      <ExercisePicker visible={pickerFor != null} onDismiss={() => setPickerFor(null)} onPick={addExercise} />
      <LocationPicker
        visible={locationOpen}
        currentId={draft.locationId}
        noneLabel="Sem local fixo"
        onDismiss={() => setLocationOpen(false)}
        onPick={(locationId) => update({ locationId })}
      />
      {machineFor && machineItem && (
        <MachinePicker
          visible
          exerciseId={machineItem.exerciseId}
          exerciseName={exerciseMap.get(machineItem.exerciseId)?.name ?? ''}
          locationId={draft.locationId}
          locationName={location?.name}
          currentMachineId={machineItem.machineId}
          onDismiss={() => setMachineFor(null)}
          onPick={(machineId) => updateItem(machineFor, { machineId })}
        />
      )}
    </KeyboardAvoidingView>
  );
}

/** One block of the routine: plain exercises (one card each) or a WOD with its settings and movements. */
function BlockEditor({
  block,
  index,
  count,
  exerciseMap,
  onChange,
  onMove,
  onRemove,
  onAddItem,
  onPickMachine,
}: {
  block: BlockDraft;
  index: number;
  count: number;
  exerciseMap: Map<string, Exercise>;
  onChange: (patch: Partial<BlockDraft>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onAddItem: () => void;
  onPickMachine: (item: number) => void;
}) {
  const theme = useTheme();
  const machineMap = useMachineMap();
  const wod = block.kind !== 'exercises';
  const setItem = (i: number, patch: Partial<WorkoutItemDraft>) =>
    onChange({ items: block.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

  const blockActions = (
    <View style={styles.row}>
      <IconButton icon="arrow-up" accessibilityLabel="Mover bloco para cima" disabled={index === 0} onPress={() => onMove(-1)} />
      <IconButton
        icon="arrow-down"
        accessibilityLabel="Mover bloco para baixo"
        disabled={index === count - 1}
        onPress={() => onMove(1)}
      />
      <IconButton icon="delete-outline" accessibilityLabel="Remover bloco" onPress={onRemove} />
    </View>
  );

  const items = block.items.map((item, i) => {
    const ex = exerciseMap.get(item.exerciseId);
    const actions = (
      <View style={styles.row}>
        <IconButton icon="arrow-up" size={18} disabled={i === 0} onPress={() => onChange({ items: move(block.items, i, -1) })} />
        <IconButton
          icon="arrow-down"
          size={18}
          disabled={i === block.items.length - 1}
          onPress={() => onChange({ items: move(block.items, i, 1) })}
        />
        <IconButton icon="delete-outline" size={18} onPress={() => onChange({ items: block.items.filter((_, j) => j !== i) })} />
      </View>
    );
    if (wod) {
      return (
        <View key={item.id ?? `new-${i}`} style={styles.movement}>
          <View style={styles.movementHeader}>
            <Text variant="titleSmall" style={styles.flex}>
              {block.alternate ? `${i + 1}º intervalo · ` : ''}
              {ex?.name ?? 'Exercício removido'}
            </Text>
            {actions}
          </View>
          <ItemFields kind={block.kind} exercise={ex} item={item} onChange={(patch) => setItem(i, patch)} />
        </View>
      );
    }
    return (
      <Card key={item.id ?? `new-${i}`} mode="contained">
        <Card.Title
          title={ex?.name ?? 'Exercício removido'}
          subtitle={item.machineId ? `⚙ ${machineMap.get(item.machineId)?.name ?? ''}` : ex?.category}
          right={() => actions}
        />
        <Card.Content>
          <Button compact icon="cog-outline" mode="text" style={styles.machineBtn} onPress={() => onPickMachine(i)}>
            {item.machineId ? 'Trocar máquina' : 'Sem máquina · adicionar'}
          </Button>
          <ItemFields kind={block.kind} exercise={ex} item={item} onChange={(patch) => setItem(i, patch)} />
        </Card.Content>
      </Card>
    );
  });

  if (!wod) {
    return (
      <View style={styles.block}>
        {count > 1 && (
          <View style={styles.blockHeader}>
            <Text variant="titleMedium" style={styles.flex}>
              Exercícios
            </Text>
            {blockActions}
          </View>
        )}
        {items}
        <Button icon="plus" mode="text" style={styles.addInBlock} onPress={onAddItem}>
          Exercício neste bloco
        </Button>
      </View>
    );
  }

  return (
    <Card mode="outlined" style={{ borderColor: theme.colors.secondary }}>
      <Card.Title
        title={describeBlockFormat(block)}
        titleVariant="titleMedium"
        left={(p) => <List.Icon {...p} icon={BLOCK_KIND_ICON[block.kind]} color={theme.colors.secondary} />}
        right={() => blockActions}
      />
      <Card.Content style={styles.wodContent}>
        <BlockConfigFields config={block} onChange={onChange} />
        <Text variant="labelLarge" style={styles.muted}>
          {block.kind === 'emom' && !block.alternate ? 'MOVIMENTOS (A CADA INTERVALO)' : block.alternate ? 'MOVIMENTOS (EM SEQUÊNCIA)' : 'MOVIMENTOS (POR ROUND)'}
        </Text>
        {items}
        <Button icon="plus" mode="text" style={styles.addInBlock} onPress={onAddItem}>
          Movimento
        </Button>
      </Card.Content>
    </Card>
  );
}

function ItemFields({
  kind,
  exercise,
  item,
  onChange,
}: {
  kind: BlockKind;
  exercise: Exercise | undefined;
  item: WorkoutItemDraft;
  onChange: (patch: Partial<WorkoutItemDraft>) => void;
}) {
  const measure = exercise?.measure ?? 'reps';
  if (kind === 'exercises') {
    return (
      <View style={styles.setsBox}>
        <SetsEditor measure={measure} sets={item.sets} onChange={(sets) => onChange({ sets })} />
        <DurationField
          label="Descanso entre séries"
          value={item.restSec}
          onChange={(restSec) => onChange({ restSec })}
        />
      </View>
    );
  }
  return (
    <View style={styles.fields}>
      {(measure === 'weight_reps' || measure === 'reps') && (
        <NumberField style={styles.field} label="Reps" value={item.reps} onChange={(reps) => onChange({ reps })} />
      )}
      {measure === 'weight_reps' && (
        <NumberField
          style={styles.field}
          label="Carga (kg)"
          decimal
          value={item.weight}
          onChange={(weight) => onChange({ weight })}
        />
      )}
      {measure === 'time' && (
        <DurationField
          style={styles.field}
          label="Tempo"
          value={item.durationSec}
          onChange={(durationSec) => onChange({ durationSec })}
        />
      )}
      {measure === 'distance' && (
        <NumberField
          style={styles.field}
          label="Distância (m)"
          decimal
          value={item.distanceM}
          onChange={(distanceM) => onChange({ distanceM })}
        />
      )}
      {measure === 'calories' && (
        <NumberField style={styles.field} label="Calorias" value={item.calories} onChange={(calories) => onChange({ calories })} />
      )}
    </View>
  );
}

/** Strength: one row per set with its own type, weight and reps. */
function SetsEditor({
  measure,
  sets,
  onChange,
}: {
  measure: Exercise['measure'];
  sets: SetDraft[];
  onChange: (sets: SetDraft[]) => void;
}) {
  const [typeFor, setTypeFor] = useState<number | null>(null);
  const labels = setLabels(sets.map((st) => st.type));
  const patch = (i: number, p: Partial<SetDraft>) => onChange(sets.map((st, j) => (j === i ? { ...st, ...p } : st)));
  const add = (type: SetType) => {
    const sameType = sets.filter((st) => st.type === type);
    const from = sameType.at(-1) ?? sets.at(-1);
    const s = newSet(type, from);
    // warm-ups go right after the existing warm-ups
    const at = type === 'warmup' ? sameType.length && sets.lastIndexOf(sameType.at(-1)!) + 1 : sets.length;
    onChange([...sets.slice(0, at), s, ...sets.slice(at)]);
  };
  const amount = measure === 'time' ? 'Tempo' : measure === 'distance' ? 'Metros' : measure === 'calories' ? 'Cal' : 'Reps';

  return (
    <View style={styles.setsBox}>
      <View style={styles.setRow}>
        <Text style={[styles.th, styles.colBadge]}>SÉRIE</Text>
        <Text style={[styles.th, styles.flex]}>{measure === 'weight_reps' ? 'KG' : ''}</Text>
        <Text style={[styles.th, styles.flex]}>{amount.toUpperCase()}</Text>
        <View style={styles.colRemove} />
      </View>
      {sets.map((st, i) => (
        <View key={st.id ?? `n-${i}`} style={styles.setRow}>
          <View style={styles.colBadge}>
            <SetBadge type={st.type} label={labels[i]} onPress={() => setTypeFor(i)} />
          </View>
          <View style={styles.flex}>
            {measure === 'weight_reps' && (
              <NumberField
                label=""
                accessibilityLabel={`Série ${labels[i]}, meta de carga em kg`}
                decimal
                value={st.weight ?? 0}
                onChange={(weight) => patch(i, { weight })}
              />
            )}
          </View>
          <View style={styles.flex}>
            {measure === 'time' ? (
              <DurationField label="" value={st.durationSec} onChange={(durationSec) => patch(i, { durationSec })} />
            ) : measure === 'distance' ? (
              <NumberField label="" decimal value={st.distanceM} onChange={(distanceM) => patch(i, { distanceM })} />
            ) : measure === 'calories' ? (
              <NumberField label="" value={st.calories} onChange={(calories) => patch(i, { calories })} />
            ) : (
              <NumberField
                label=""
                accessibilityLabel={`Série ${labels[i]}, meta de repetições`}
                value={st.reps}
                onChange={(reps) => patch(i, { reps })}
              />
            )}
          </View>
          <IconButton
            icon="close"
            size={18}
            style={styles.colRemove}
            disabled={sets.length <= 1}
            accessibilityLabel={`Remover série ${labels[i]}`}
            onPress={() => onChange(sets.filter((_, j) => j !== i))}
          />
        </View>
      ))}
      <View style={styles.row}>
        <Button icon="plus" mode="contained-tonal" style={styles.flex} textColor="#F5C451" onPress={() => add('warmup')}>
          Aquecimento
        </Button>
        <Button icon="plus" mode="contained-tonal" style={styles.flex} onPress={() => add('normal')}>
          Série normal
        </Button>
      </View>
      {typeFor != null && sets[typeFor] && (
        <SetTypeDialog
          visible
          current={sets[typeFor].type}
          onDismiss={() => setTypeFor(null)}
          onPick={(type) => patch(typeFor, { type })}
          onRemove={sets.length > 1 ? () => onChange(sets.filter((_, j) => j !== typeFor)) : undefined}
        />
      )}
    </View>
  );
}

function validate(d: WorkoutDraft): string[] {
  const errors: string[] = [];
  if (!d.name.trim()) errors.push('Dê um nome ao treino.');
  if (!d.blocks.some((b) => b.items.length)) errors.push('Adicione pelo menos um exercício.');
  for (const b of d.blocks) {
    if (b.kind === 'amrap' && !b.durationSec) errors.push('Informe a duração do AMRAP.');
    if (b.kind === 'emom' && (!b.intervalSec || !b.rounds)) errors.push('Informe intervalo e número de intervalos do EMOM.');
    if (b.kind !== 'exercises' && !b.items.length) errors.push(`Adicione movimentos ao ${BLOCK_KIND_LABEL[b.kind]}.`);
  }
  return [...new Set(errors)];
}

/** Trims the name and drops empty blocks. */
function cleanDraft(d: WorkoutDraft): WorkoutDraft {
  return { ...d, name: d.name.trim(), blocks: d.blocks.filter((b) => b.items.length) };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  block: { gap: 12 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  addInBlock: { alignSelf: 'flex-start' },
  wodContent: { gap: 12 },
  movement: { gap: 4 },
  movementHeader: { flexDirection: 'row', alignItems: 'center' },
  muted: { opacity: 0.7, letterSpacing: 0.6 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { flexGrow: 1, flexBasis: 90 },
  locationBtn: { borderRadius: 12 },
  machineBtn: { alignSelf: 'flex-start', marginLeft: -8, marginBottom: 4 },
  setsBox: { gap: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  th: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, opacity: 0.7, textAlign: 'center' },
  colBadge: { width: 44, alignItems: 'center' },
  colRemove: { width: 36, margin: 0 },
});
