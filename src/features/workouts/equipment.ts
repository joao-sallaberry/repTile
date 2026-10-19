import type { Equipment, Exercise } from '@/db/schema';

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  none: 'Livre',
  barbell: 'Barra',
  band: 'Elástico',
  dumbbell: 'Halter',
  suspension: 'Fita de suspensão',
  kettlebell: 'Kettlebell',
  cable: 'Polia',
  machine: 'Máquina',
  other: 'Outro',
};

/** One equipment: "Halter", or "Livre" for bodyweight. */
export const equipmentLabel = (e: Equipment) => EQUIPMENT_LABEL[e];

/** Everything the exercise can be done with: "Barra, halter, polia", or "Livre, halter". */
export const equipmentText = (e: Pick<Exercise, 'equipment'>) =>
  e.equipment.map((x, i) => (i === 0 ? equipmentLabel(x) : equipmentLabel(x).toLowerCase())).join(', ');

/** The equipment a new routine item or session exercise starts with. */
export const defaultEquipment = (e: Pick<Exercise, 'equipment'> | undefined): Equipment => e?.equipment[0] ?? 'none';

/** Machine and cable exercises are done on a specific station, picked with `MachinePicker`. */
export const hasStation = (equipment: Equipment | null | undefined) => equipment === 'machine' || equipment === 'cable';

/** What the station is called in the UI: "polia" for cable, else "máquina". */
export const stationNoun = (equipment: Equipment | null | undefined) => (equipment === 'cable' ? 'polia' : 'máquina');

/** Toggles one equipment in an exercise's list, keeping it non-empty. "none" (Livre) is one more option. */
export function toggleEquipment(list: Equipment[], e: Equipment): Equipment[] {
  if (list.includes(e)) return list.length > 1 ? list.filter((x) => x !== e) : list;
  return [...list, e];
}

/** Equipment filter: none picked = all; else the exercise can be done with any of the picked ones. */
export const matchesEquipment = (e: Pick<Exercise, 'equipment'>, filter: Equipment[]) =>
  !filter.length || filter.some((f) => e.equipment.includes(f));
