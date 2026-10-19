import type { Equipment } from '@/db/schema';

import { equipmentText, matchesEquipment, toggleEquipment } from './equipment';

test('equipmentText lists every equipment', () => {
  expect(equipmentText({ equipment: ['barbell', 'dumbbell', 'cable'] })).toBe('Barra, halter, polia');
  expect(equipmentText({ equipment: ['none'] })).toBe('Sem equipamento');
});

test('toggleEquipment keeps the list non-empty and "none" exclusive', () => {
  expect(toggleEquipment(['barbell'], 'dumbbell')).toEqual(['barbell', 'dumbbell']);
  expect(toggleEquipment(['barbell', 'dumbbell'], 'barbell')).toEqual(['dumbbell']);
  expect(toggleEquipment(['barbell'], 'barbell')).toEqual(['barbell']);
  expect(toggleEquipment(['barbell', 'dumbbell'], 'none')).toEqual(['none']);
  expect(toggleEquipment(['none'], 'band')).toEqual(['band']);
});

test('matchesEquipment: any picked equipment', () => {
  const curl: Equipment[] = ['barbell', 'dumbbell', 'cable'];
  expect(matchesEquipment({ equipment: curl }, [])).toBe(true);
  expect(matchesEquipment({ equipment: curl }, ['cable'])).toBe(true);
  expect(matchesEquipment({ equipment: curl }, ['kettlebell', 'dumbbell'])).toBe(true);
  expect(matchesEquipment({ equipment: curl }, ['machine'])).toBe(false);
});
