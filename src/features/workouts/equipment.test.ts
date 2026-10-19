import type { Equipment } from '@/db/schema';

import { equipmentText, matchesEquipment, toggleEquipment } from './equipment';

test('equipmentText lists every equipment', () => {
  expect(equipmentText({ equipment: ['barbell', 'dumbbell', 'cable'] })).toBe('Barra, halter, polia');
  expect(equipmentText({ equipment: ['none'] })).toBe('Livre');
  expect(equipmentText({ equipment: ['none', 'dumbbell'] })).toBe('Livre, halter');
});

test('toggleEquipment keeps the list non-empty', () => {
  expect(toggleEquipment(['barbell'], 'dumbbell')).toEqual(['barbell', 'dumbbell']);
  expect(toggleEquipment(['barbell', 'dumbbell'], 'barbell')).toEqual(['dumbbell']);
  expect(toggleEquipment(['barbell'], 'barbell')).toEqual(['barbell']);
  expect(toggleEquipment(['barbell', 'dumbbell'], 'none')).toEqual(['barbell', 'dumbbell', 'none']);
  expect(toggleEquipment(['none'], 'band')).toEqual(['none', 'band']);
});

test('matchesEquipment: any picked equipment', () => {
  const curl: Equipment[] = ['barbell', 'dumbbell', 'cable'];
  expect(matchesEquipment({ equipment: curl }, [])).toBe(true);
  expect(matchesEquipment({ equipment: curl }, ['cable'])).toBe(true);
  expect(matchesEquipment({ equipment: curl }, ['kettlebell', 'dumbbell'])).toBe(true);
  expect(matchesEquipment({ equipment: curl }, ['machine'])).toBe(false);
});
