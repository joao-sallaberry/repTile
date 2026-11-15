import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  HelperText,
  Icon,
  IconButton,
  List,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import { BlockConfigFields } from '@/components/block-config-fields';
import { FilterChip } from '@/components/filter-chips';
import { DurationField } from '@/components/duration-field';
import { EquipmentMenu } from '@/components/equipment-menu';
import { ExerciseThumb } from '@/components/exercise-media';
import { ExercisePicker } from '@/components/exercise-picker';
import { LocationPicker } from '@/components/location-picker';
import { MachinePicker } from '@/components/machine-picker';
import { NumberField } from '@/components/number-field';
import { canReorder, ReorderSheet, type ReorderGroup } from '@/components/reorder-sheet';
import { RestPicker } from '@/components/rest-picker';
import { SetBadge } from '@/components/set-badge';
import { SetTypeDialog } from '@/components/set-type-dialog';
import type { BlockKind, Exercise, SetType } from '@/db/schema';
import { useLocation, useLocations, useMachineMap } from '@/features/places/queries';
import { setLabels } from '@/features/session/sets';
import { BLOCK_KIND_ICON, BLOCK_KIND_LABEL, describeBlockFormat, WOD_KINDS } from '@/features/workouts/blocks';
import { defaultEquipment, equipmentText, hasStation, stationNoun } from '@/features/workouts/equipment';
import { useExerciseMap } from '@/features/workouts/queries';
import {
  emptyBlock,
  emptyItem,
  emptyWorkout,
  deleteWorkout,
  getWorkoutDraft,
  newSet,
  saveWorkout,
  stripIds,
  type BlockDraft,
  type SetDraft,
  type WorkoutDraft,
  type WorkoutItemDraft,
} from '@/features/workouts/repo';
import { variantKeys, variantLocation, type VariantKey } from '@/features/workouts/variants';
import { formatDuration } from '@/lib/format';

type ItemRef = { block: number; item: number };

export default function EditWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [draft, setDraft] = useState<WorkoutDraft | null>(id ? null : emptyWorkout());
  const [pickerFor, setPickerFor] = useState<number | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [machineFor, setMachineFor] = useState<ItemRef | null>(null);
  /** Location variant being edited (ADR 0020): `null` = the main routine. */
  const [variant, setVariant] = useState<VariantKey>(null);
  /** Variants just added, before they have blocks. */
  const [newVariants, setNewVariants] = useState<string[]>([]);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const exerciseMap = useExerciseMap();
  const location = useLocation(draft?.locationId);
  const locations = useLocations();
  const theme = useTheme();

  useEffect(() => {
    if (id) getWorkoutDraft(id).then(setDraft);
  }, [id]);

  if (!draft) return null;

  // The variant being edited stays listed even with no blocks left (validation then asks for exercises).
  const keys = [...new Set([...variantKeys(draft.blocks), ...newVariants, variant])];
  const variantName = (key: VariantKey) =>
    key == null ? (location?.name ?? 'Outros locais') : (locations.find((l) => l.id === key)?.name ?? 'Local removido');
  /** Indices (in `draft.blocks`) of the blocks of the variant being edited. */
  const shown = draft.blocks.flatMap((b, i) => (b.locationId === variant ? [i] : []));
  const shownBlocks = shown.map((i) => draft.blocks[i]);
  const variantLocationId = variantLocation(variant, draft.locationId);
  const variantLocationName = variantLocationId ? locations.find((l) => l.id === variantLocationId)?.name : undefined;

  /** A new variant for `locationId`, starting as a copy of the one being edited. */
  const addVariant = (locationId: string | null) => {
    if (locationId == null) return;
    const copy = stripIds({ ...draft, blocks: shownBlocks }).blocks.map((b) => ({ ...b, locationId }));
    update({ blocks: [...draft.blocks, ...copy] });
    setNewVariants([...newVariants, locationId]);
    setVariant(locationId);
  };
  const removeVariant = (key: string) =>
    Alert.alert(`Remover a versão de ${variantName(key)}?`, `Lá, a rotina passa a ser a de ${variantName(null)}.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          update({ blocks: draft.blocks.filter((b) => b.locationId !== key) });
          setNewVariants(newVariants.filter((k) => k !== key));
          setVariant(null);
        },
      },
    ]);

  const update = (patch: Partial<WorkoutDraft>) => setDraft({ ...draft, ...patch });
  const updateBlock = (index: number, patch: Partial<BlockDraft>) =>
    update({ blocks: draft.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)) });
  const updateItem = ({ block, item }: ItemRef, patch: Partial<WorkoutItemDraft>) =>
    updateBlock(block, { items: draft.blocks[block].items.map((it, i) => (i === item ? { ...it, ...patch } : it)) });

  /** Adds the exercises picked: to the given block, or to a trailing exercises block (created if needed). */
  const addExercises = (exerciseIds: string[]) => {
    if (typeof pickerFor === 'number') {
      const b = draft.blocks[pickerFor];
      updateBlock(pickerFor, { items: [...b.items, ...exerciseIds.map((id) => emptyItem(id, b.kind))] });
      return;
    }
    const items = exerciseIds.map((id) => emptyItem(id, 'exercises'));
    const lastIndex = shown.at(-1);
    const last = lastIndex != null ? draft.blocks[lastIndex] : undefined;
    if (lastIndex != null && last?.kind === 'exercises') {
      updateBlock(lastIndex, { items: [...last.items, ...items] });
    } else {
      update({ blocks: [...draft.blocks, { ...emptyBlock('exercises', variant), items }] });
    }
  };

  const addBlock = (kind: BlockKind) => {
    update({ blocks: [...draft.blocks, emptyBlock(kind, variant)] });
    setPickerFor(draft.blocks.length);
  };

  const errors = validate(draft, keys.length > 1 ? keys : [null], variantName);
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

  const reorderGroups: ReorderGroup<BlockDraft, WorkoutItemDraft>[] = shown.map((bi) => draft.blocks[bi]).map((b, bi) => ({
    key: `b${bi}`,
    title: describeBlockFormat(b) ?? BLOCK_KIND_LABEL[b.kind],
    icon: BLOCK_KIND_ICON[b.kind],
    value: b,
    items: b.items.map((it, i) => ({
      key: `${bi}-${i}`,
      title: exerciseMap.get(it.exerciseId)?.name ?? 'Exercício removido',
      value: it,
    })),
  }));

  const confirmDelete = () =>
    Alert.alert('Excluir rotina?', 'O histórico de execuções será mantido.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (id) await deleteWorkout(id);
          router.dismissAll();
        },
      },
    ]);
  const hasExercisesBlock = shownBlocks.some((b) => b.kind === 'exercises');

  const machineItem = machineFor ? draft.blocks[machineFor.block]?.items[machineFor.item] : undefined;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <Stack.Screen
        options={{
          title: id ? 'Editar rotina' : 'Nova rotina',
          headerLeft: () => (
            <Button compact onPress={() => router.back()} textColor={theme.colors.onSurfaceVariant}>
              Cancelar
            </Button>
          ),
          headerRight: () => (
            <Button mode="contained" onPress={save} disabled={errors.length > 0 || saving} loading={saving}>
              Salvar
            </Button>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput mode="outlined" label="Nome" value={draft.name} onChangeText={(name) => update({ name })} />

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

        {keys.length > 1 ? (
          <View style={styles.variants}>
            <Text variant="labelLarge" style={styles.muted}>
              VERSÃO POR LOCAL
            </Text>
            <View style={styles.chips}>
              {keys.map((k) => (
                <FilterChip key={k ?? 'main'} icon="map-marker-outline" selected={k === variant} onPress={() => setVariant(k)}>
                  {variantName(k)}
                </FilterChip>
              ))}
              <FilterChip icon="plus" selected={false} onPress={() => setVariantPickerOpen(true)}>
                Local
              </FilterChip>
            </View>
            <Text variant="bodySmall" style={styles.muted}>
              {variant == null
                ? `Feita ${location ? `em ${location.name}` : 'nos locais sem versão própria'}.`
                : `Feita quando o treino começa em ${variantName(variant)}. Exercícios, ordem e séries são só desta versão.`}
            </Text>
          </View>
        ) : (
          <Button
            compact
            icon="map-marker-plus-outline"
            style={styles.addVariant}
            onPress={() => setVariantPickerOpen(true)}>
            Versão diferente para outro local
          </Button>
        )}

        <TextInput
          mode="outlined"
          label="Observações"
          multiline
          value={draft.notes ?? ''}
          onChangeText={(notes) => update({ notes: notes || null })}
        />

        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.flex}>
            Exercícios
          </Text>
          {canReorder(reorderGroups) && (
            <Button compact mode="outlined" icon="swap-vertical" onPress={() => setReorderOpen(true)}>
              Reordenar
            </Button>
          )}
        </View>

        {shown.map((bi) => draft.blocks[bi]).map((block, i) => (
          <BlockEditor
            key={block.id ?? `new-${shown[i]}`}
            block={block}
            count={shown.length}
            exerciseMap={exerciseMap}
            onChange={(patch) => updateBlock(shown[i], patch)}
            onRemove={() => update({ blocks: draft.blocks.filter((_, j) => j !== shown[i]) })}
            onAddItem={() => setPickerFor(shown[i])}
            onPickMachine={(item) => setMachineFor({ block: shown[i], item })}
            onRestAll={(restSec) =>
              update({
                blocks: draft.blocks.map((b) =>
                  b.locationId === variant && b.kind === 'exercises' ? { ...b, items: b.items.map((it) => ({ ...it, restSec })) } : b,
                ),
              })
            }
          />
        ))}

        {!hasExercisesBlock && <DashedButton label="Adicionar exercício" onPress={() => setPickerFor('new')} />}

        <View style={styles.addBlock}>
          <Text variant="titleSmall" style={styles.muted}>
            Adicionar bloco
          </Text>
          <View style={styles.row}>
            {WOD_KINDS.map((k) => (
              <TouchableRipple
                key={k}
                borderless
                accessibilityRole="button"
                accessibilityLabel={`Adicionar bloco ${BLOCK_KIND_LABEL[k]}`}
                onPress={() => addBlock(k)}
                style={[styles.kind, { borderColor: theme.colors.outlineVariant }]}>
                <View style={styles.kindInner}>
                  <Icon source={BLOCK_KIND_ICON[k]} size={20} color={theme.colors.secondary} />
                  <Text variant="labelMedium" numberOfLines={1}>
                    {BLOCK_KIND_LABEL[k]}
                  </Text>
                </View>
              </TouchableRipple>
            ))}
          </View>
        </View>
        {errors.map((e) => (
          <HelperText key={e} type="info">
            {e}
          </HelperText>
        ))}
        {variant != null && (
          <Button icon="map-marker-remove-outline" textColor={theme.colors.error} onPress={() => removeVariant(variant)}>
            Remover versão de {variantName(variant)}
          </Button>
        )}
        {id && (
          <Button icon="delete-outline" textColor={theme.colors.error} style={styles.delete} onPress={confirmDelete}>
            Excluir rotina
          </Button>
        )}
      </ScrollView>

      <ReorderSheet
        visible={reorderOpen}
        groups={reorderGroups}
        onDismiss={() => setReorderOpen(false)}
        onSave={(groups) =>
          update({
            blocks: [
              ...draft.blocks.filter((b) => b.locationId !== variant),
              ...groups.map((g) => ({ ...g.value, items: g.items.map((i) => i.value) })),
            ],
          })
        }
      />
      <ExercisePicker visible={pickerFor != null} onDismiss={() => setPickerFor(null)} onPick={addExercises} />
      <LocationPicker
        visible={locationOpen}
        currentId={draft.locationId}
        noneLabel="Sem local fixo"
        exclude={keys}
        onDismiss={() => setLocationOpen(false)}
        onPick={(locationId) => update({ locationId })}
      />
      <LocationPicker
        visible={variantPickerOpen}
        title="Versão para o local"
        currentId={null}
        noneLabel={null}
        exclude={[draft.locationId, ...keys]}
        onDismiss={() => setVariantPickerOpen(false)}
        onPick={addVariant}
      />
      {machineFor && machineItem && (
        <MachinePicker
          visible
          exerciseId={machineItem.exerciseId}
          exerciseName={exerciseMap.get(machineItem.exerciseId)?.name ?? ''}
          noun={stationNoun(machineItem.equipment ?? defaultEquipment(exerciseMap.get(machineItem.exerciseId)))}
          locationId={variantLocationId}
          locationName={variantLocationName}
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
  count,
  exerciseMap,
  onChange,
  onRemove,
  onAddItem,
  onPickMachine,
  onRestAll,
}: {
  block: BlockDraft;
  /** Number of blocks in the routine (a lone exercises block has no header). */
  count: number;
  exerciseMap: Map<string, Exercise>;
  onChange: (patch: Partial<BlockDraft>) => void;
  onRemove: () => void;
  onAddItem: () => void;
  onPickMachine: (item: number) => void;
  /** Same rest for every exercise of the version being edited. */
  onRestAll: (restSec: number | null) => void;
}) {
  const theme = useTheme();
  const machineMap = useMachineMap();
  const wod = block.kind !== 'exercises';
  const setItem = (i: number, patch: Partial<WorkoutItemDraft>) =>
    onChange({ items: block.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  /** Alternating EMOM: each movement is one interval, called "minuto" when it lasts 60 s (as in the timer). */
  const unit = block.intervalSec === 60 ? 'minuto' : 'intervalo';
  const last = block.items.at(-1);
  /** Next interval = a copy of the last one (same exercise, reps, load…), as a new item. */
  const copyLast = () => {
    if (!last) return;
    const { id: _id, ...copy } = last;
    onChange({ items: [...block.items, { ...copy, sets: [] }] });
  };

  const blockActions = (
    <IconButton icon="delete-outline" size={20} style={styles.compactIcon} accessibilityLabel="Remover bloco" onPress={onRemove} />
  );

  const items = block.items.map((item, i) => {
    const ex = exerciseMap.get(item.exerciseId);
    const actions = (
      <IconButton
        icon="delete-outline"
        size={18}
        accessibilityLabel={`Remover ${ex?.name ?? 'exercício'}`}
        onPress={() => onChange({ items: block.items.filter((_, j) => j !== i) })}
      />
    );
    if (wod) {
      return (
        <View key={item.id ?? `new-${i}`} style={styles.movement}>
          <View style={styles.movementHeader}>
            <Text variant="titleSmall" style={styles.flex}>
              {block.alternate ? `${i + 1}º ${unit} · ` : ''}
              {ex?.name ?? 'Exercício removido'}
            </Text>
            {actions}
          </View>
          <ItemFields kind={block.kind} exercise={ex} item={item} onChange={(patch) => setItem(i, patch)} />
        </View>
      );
    }
    const equipment = item.equipment ?? defaultEquipment(ex);
    const choices = ex?.equipment ?? [];
    const station = hasStation(equipment) || item.machineId != null;
    const machine = item.machineId ? machineMap.get(item.machineId) : undefined;
    return (
      <Card key={item.id ?? `new-${i}`} mode="contained">
        <View style={styles.cardHeader}>
          <ExerciseThumb exerciseId={item.exerciseId} equipment={equipment} size={44} />
          <View style={styles.flex}>
            <Text variant="titleMedium" style={{ color: theme.colors.primary }} numberOfLines={2}>
              {ex?.name ?? 'Exercício removido'}
            </Text>
            {ex && (
              <Text variant="bodySmall" style={styles.muted}>
                {choices.length > 1 || station ? ex.category : `${ex.category} · ${equipmentText(ex)}`}
              </Text>
            )}
          </View>
          {actions}
        </View>
        <View style={styles.pills}>
          <EquipmentMenu
            pill
            options={choices}
            value={equipment}
            onChange={(e) => setItem(i, { equipment: e, machineId: hasStation(e) ? item.machineId : null })}
          />
          {station && (
            <TouchableRipple
              borderless
              accessibilityRole="button"
              accessibilityLabel={
                machine ? `${stationNoun(equipment)}: ${machine.name}. Toque para trocar` : `Escolher ${stationNoun(equipment)}`
              }
              onPress={() => onPickMachine(i)}
              style={[styles.pill, styles.shrink, { backgroundColor: theme.colors.elevation.level3 }]}>
              <View style={styles.pillInner}>
                <Icon source="cog-outline" size={15} color={theme.colors.onSurfaceVariant} />
                <Text variant="labelLarge" numberOfLines={1} style={styles.shrink}>
                  {machine?.name ?? `Sem ${stationNoun(equipment)} · adicionar`}
                </Text>
                <Icon source="menu-down" size={16} color={theme.colors.onSurfaceVariant} />
              </View>
            </TouchableRipple>
          )}
          <RestPill value={item.restSec} onChange={(restSec, all) => (all ? onRestAll(restSec) : setItem(i, { restSec }))} />
        </View>
        <Card.Content>
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
            <Text variant="labelLarge" style={[styles.flex, styles.muted]}>
              BLOCO DE EXERCÍCIOS
            </Text>
            {blockActions}
          </View>
        )}
        {items}
        <DashedButton label="Adicionar exercício" onPress={onAddItem} />
      </View>
    );
  }

  return (
    <Card mode="outlined" style={{ borderColor: theme.colors.secondaryContainer }}>
      <View style={styles.cardHeader}>
        <View style={[styles.wodIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
          <Icon source={BLOCK_KIND_ICON[block.kind]} size={20} color={theme.colors.onSecondaryContainer} />
        </View>
        <Text variant="titleMedium" style={styles.flex} numberOfLines={2}>
          {describeBlockFormat(block)}
        </Text>
        {blockActions}
      </View>
      <Card.Content style={styles.wodContent}>
        <BlockConfigFields config={block} onChange={onChange} />
        <Text variant="labelLarge" style={styles.muted}>
          {block.kind === 'emom' && !block.alternate
            ? 'MOVIMENTOS (A CADA INTERVALO)'
            : block.alternate
              ? 'MOVIMENTOS (EM SEQUÊNCIA)'
              : block.kind === 'tabata'
                ? 'MOVIMENTOS (UM POR ROUND, EM SEQUÊNCIA)'
                : 'MOVIMENTOS (POR ROUND)'}
        </Text>
        {items}
        <View style={styles.wodButtons}>
          <Button icon="plus" mode="text" onPress={onAddItem}>
            Movimento
          </Button>
          {block.kind === 'emom' && block.alternate && last && (
            <Button
              icon="content-copy"
              mode="text"
              accessibilityLabel={`Copiar o ${block.items.length}º ${unit} para o ${block.items.length + 1}º`}
              onPress={copyLast}>
              {`Copiar ${block.items.length}º ${unit}`}
            </Button>
          )}
        </View>
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
          Série
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

/** "+ Adicionar exercício": the dashed orange button at the end of an exercises block. */
function DashedButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableRipple
      borderless
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.dashed, { borderColor: theme.colors.primaryContainer }]}>
      <View style={styles.pillInner}>
        <Icon source="plus" size={18} color={theme.colors.primary} />
        <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
          {label}
        </Text>
      </View>
    </TouchableRipple>
  );
}

/** "Descanso 1:30": the rest between sets, edited with `RestPicker`. */
function RestPill({ value, onChange }: { value: number | null; onChange: (sec: number | null, all: boolean) => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const text = value ? formatDuration(value) : 'sem';
  return (
    <>
      <TouchableRipple
        borderless
        accessibilityRole="button"
        accessibilityLabel={`Descanso entre séries: ${text}. Toque para mudar`}
        onPress={() => setOpen(true)}
        style={[styles.pill, { backgroundColor: theme.colors.secondaryContainer }]}>
        <View style={styles.pillInner}>
          <Icon source="timer-outline" size={15} color={theme.colors.onSecondaryContainer} />
          <Text variant="labelLarge" style={{ color: theme.colors.onSecondaryContainer }}>
            Descanso {text}
          </Text>
        </View>
      </TouchableRipple>
      <RestPicker visible={open} value={value} allowAll onDismiss={() => setOpen(false)} onSave={onChange} />
    </>
  );
}

/** `keys`: the variants to check (just the main one when there are no others), named by `nameOf` in messages. */
function validate(d: WorkoutDraft, keys: VariantKey[], nameOf: (k: VariantKey) => string): string[] {
  const errors: string[] = [];
  if (!d.name.trim()) errors.push('Dê um nome ao treino.');
  for (const k of keys) {
    if (!d.blocks.some((b) => b.locationId === k && b.items.length)) {
      errors.push(keys.length > 1 ? `Adicione pelo menos um exercício à versão de ${nameOf(k)}.` : 'Adicione pelo menos um exercício.');
    }
  }
  for (const b of d.blocks) {
    if (b.kind === 'amrap' && !b.durationSec) errors.push('Informe a duração do AMRAP.');
    if (b.kind === 'emom' && (!b.intervalSec || !b.rounds)) errors.push('Informe intervalo e número de intervalos do EMOM.');
    if (b.kind === 'tabata' && (!b.workSec || !b.rounds)) errors.push('Informe o tempo de trabalho e os rounds do Tabata.');
    if (b.kind !== 'exercises' && !b.items.length) errors.push(`Adicione movimentos ao ${BLOCK_KIND_LABEL[b.kind]}.`);
  }
  return [...new Set(errors)];
}

/** Trims the name and drops empty blocks. */
function cleanDraft(d: WorkoutDraft): WorkoutDraft {
  return { ...d, name: d.name.trim(), blocks: d.blocks.filter((b) => b.items.length) };
}

const styles = StyleSheet.create({
  // Card title actions: 40 px buttons so the block format keeps room next to them.
  compactIcon: { margin: 0 },
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  block: { gap: 12 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  wodButtons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  wodContent: { gap: 12 },
  movement: { gap: 4 },
  movementHeader: { flexDirection: 'row', alignItems: 'center' },
  muted: { opacity: 0.7, letterSpacing: 0.6 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { flexGrow: 1, flexBasis: 90 },
  locationBtn: { borderRadius: 12 },
  variants: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addVariant: { alignSelf: 'flex-start' },
  setsBox: { gap: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  th: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, opacity: 0.7, textAlign: 'center' },
  colBadge: { width: 44, alignItems: 'center' },
  colRemove: { width: 36, margin: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, paddingLeft: 14, paddingRight: 4 },
  wodIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  pill: { borderRadius: 17, minHeight: 34, justifyContent: 'center', paddingHorizontal: 12 },
  pillInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  dashed: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 14, minHeight: 48, justifyContent: 'center' },
  addBlock: { gap: 8, marginTop: 12 },
  kind: { flex: 1, borderWidth: 1, borderRadius: 14, minHeight: 64, justifyContent: 'center' },
  kindInner: { alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  delete: { marginTop: 16 },
});
