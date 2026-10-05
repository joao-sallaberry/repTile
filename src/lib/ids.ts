import { randomUUID } from 'expo-crypto';

export const newId = () => randomUUID();

/** Audit fields for a new record. */
export function createdFields() {
  const now = Date.now();
  return { id: newId(), createdAt: now, updatedAt: now, dirty: true };
}

/** Fields to set whenever a record changes locally. */
export function touched() {
  return { updatedAt: Date.now(), dirty: true };
}
