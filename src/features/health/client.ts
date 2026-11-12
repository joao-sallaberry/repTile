/**
 * Thin wrapper over Health Connect (ADR 0021). The only module that imports `react-native-health-connect`:
 * everything else works with plain numbers (ms timestamps) and the types below.
 */
import { Linking, Platform } from 'react-native';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
  type ReadRecordsOptions,
  type RecordType,
} from 'react-native-health-connect';

import type { HeartRatePoint } from './heart-rate';
import type { HealthExercise } from './match';

/** Health Connect only lets apps read this far back without the history permission. */
export const READ_WINDOW_MS = 30 * 24 * 60 * 60_000;

const READ_TYPES: RecordType[] = ['ExerciseSession', 'HeartRate', 'ActiveCaloriesBurned', 'TotalCaloriesBurned'];
const PERMISSIONS: Permission[] = READ_TYPES.map((recordType) => ({ accessType: 'read', recordType }));
/** Needed to link anything; calories are a bonus. */
const REQUIRED: RecordType[] = ['ExerciseSession', 'HeartRate'];

export type HealthStatus =
  /** Not Android, or Health Connect isn't on the phone. */
  | 'unavailable'
  /** Health Connect must be installed or updated from the Play Store. */
  | 'update_required'
  | 'not_granted'
  | 'granted';

let initialized: Promise<boolean> | null = null;
function ensureInitialized() {
  initialized ??= initialize().catch(() => {
    initialized = null;
    return false;
  });
  return initialized;
}

export async function healthStatus(): Promise<HealthStatus> {
  if (Platform.OS !== 'android') return 'unavailable';
  const sdk = await getSdkStatus();
  if (sdk === SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'unavailable';
  if (sdk === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_required';
  if (!(await ensureInitialized())) return 'unavailable';
  const granted = new Set((await getGrantedPermissions()).map((p) => `${p.accessType}:${p.recordType}`));
  return REQUIRED.every((t) => granted.has(`read:${t}`)) ? 'granted' : 'not_granted';
}

/** Shows the Health Connect permission screen; resolves to the new status. */
export async function requestHealthPermissions(): Promise<HealthStatus> {
  if (!(await ensureInitialized())) return healthStatus();
  await requestPermission(PERMISSIONS);
  return healthStatus();
}

export { openHealthConnectSettings };

/** The Google Health app (still the Fitbit package), which writes the watch data to Health Connect. */
export const GOOGLE_HEALTH_PACKAGE = 'com.fitbit.FitbitMobile';

/**
 * Opens Health Connect's permission screen for Google Health, where the user lets it write workouts there
 * (RepTile can't grant another app's permissions). Falls back to Health Connect's home screen.
 */
export async function openSourcePermissions() {
  try {
    await Linking.sendIntent('android.health.connect.action.MANAGE_HEALTH_PERMISSIONS', [
      { key: 'android.intent.extra.PACKAGE_NAME', value: GOOGLE_HEALTH_PACKAGE },
    ]);
  } catch {
    openHealthConnectSettings();
  }
}

const between = (from: number, to: number): ReadRecordsOptions['timeRangeFilter'] => ({
  operator: 'between',
  startTime: new Date(Math.max(from, Date.now() - READ_WINDOW_MS + 60_000)).toISOString(),
  endTime: new Date(to).toISOString(),
});

/** Every page of a read. */
async function readAll<T extends RecordType>(type: T, from: number, to: number) {
  await ensureInitialized();
  const records = [];
  let pageToken: string | undefined;
  do {
    const page = await readRecords(type, { timeRangeFilter: between(from, to), pageToken });
    records.push(...page.records);
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return records;
}

type ExerciseRecord = Awaited<ReturnType<typeof readRecords<'ExerciseSession'>>>['records'][number];

const toExercise = (r: ExerciseRecord): HealthExercise => ({
  id: r.metadata?.id ?? '',
  start: Date.parse(r.startTime),
  end: Date.parse(r.endTime),
  exerciseType: r.exerciseType,
  title: r.title ?? null,
  source: r.metadata?.dataOrigin ?? null,
});

/**
 * The most recent exercise record of the last 30 days, from any app. `null` = the watch data isn't reaching
 * Health Connect.
 */
export async function latestExercise(): Promise<HealthExercise | null> {
  await ensureInitialized();
  const now = Date.now();
  const page = await readRecords('ExerciseSession', {
    timeRangeFilter: between(now - READ_WINDOW_MS, now),
    ascendingOrder: false,
    pageSize: 1,
  });
  return page.records[0] ? toExercise(page.records[0]) : null;
}

/** Exercise records overlapping [from, to]. */
export async function readExercises(from: number, to: number): Promise<HealthExercise[]> {
  const records = await readAll('ExerciseSession', from, to);
  return records
    .filter((r) => r.metadata?.id)
    .map(toExercise)
    .sort((a, b) => a.start - b.start);
}

export async function readHeartRate(from: number, to: number): Promise<HeartRatePoint[]> {
  const records = await readAll('HeartRate', from, to);
  return records.flatMap((r) => r.samples.map((s) => ({ time: Date.parse(s.time), bpm: s.beatsPerMinute })));
}

/** kcal burned in [from, to]: active calories when any were recorded, else total. `null` when neither. */
export async function readCalories(from: number, to: number): Promise<number | null> {
  await ensureInitialized();
  const timeRangeFilter = between(from, to);
  try {
    const active = await aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter });
    if (active.dataOrigins.length > 0 && active.ACTIVE_CALORIES_TOTAL.inKilocalories > 0) {
      return Math.round(active.ACTIVE_CALORIES_TOTAL.inKilocalories);
    }
    const total = await aggregateRecord({ recordType: 'TotalCaloriesBurned', timeRangeFilter });
    if (total.dataOrigins.length > 0 && total.ENERGY_TOTAL.inKilocalories > 0) {
      return Math.round(total.ENERGY_TOTAL.inKilocalories);
    }
  } catch {
    // Calorie permissions are optional.
  }
  return null;
}
