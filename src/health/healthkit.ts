/**
 * Capa de acceso a HealthKit (Apple Health) — SOLO LECTURA.
 *
 * Es el único archivo de la app que conoce la librería `@kingstinct/react-native-healthkit`.
 * El resto del código usa las funciones y tipos de aquí, así que cambiar de librería no
 * obliga a tocar pantallas ni, más adelante, el cálculo del Fit Score.
 *
 * Reglas de diseño:
 *  - Nunca crashea fuera de iOS: en web/Android (o iOS sin HealthKit) las lecturas devuelven
 *    valores vacíos y `getHealthStatus()` explica por qué.
 *  - La librería CRASHEA la app si se consulta un tipo sin haber pedido permiso antes. Por eso
 *    toda lectura pasa por `ready()`, que solo deja pasar cuando los permisos ya se pidieron.
 *  - iOS no revela si el permiso de LECTURA fue concedido o negado (privacidad): un permiso
 *    negado se ve igual que "no hay datos". No hay forma de distinguirlos desde código.
 *  - Los fallos reales de una lectura se lanzan como excepción; `readHealthSnapshot` los
 *    aísla métrica por métrica para que una no tumbe a las demás.
 */
import { Platform } from 'react-native';

import { buildNights, pickLastNight } from './sleep';
import type {
  DateRange,
  HealthSnapshot,
  HealthStatus,
  HealthWeekData,
  HeartRateReading,
  HeartRateSample,
  Metric,
  RequestPermissionsResult,
  RestingHeartRateReading,
  SleepNight,
  SleepSegment,
  SleepStage,
  SumReading,
  TimedSample,
  WorkoutSummary,
} from './types';

type HealthKitLib = typeof import('@kingstinct/react-native-healthkit');

/**
 * Carga diferida de la librería: en web/Android el módulo nativo nunca se evalúa, aunque
 * el bundler lo incluya. Solo se llama después de comprobar que la plataforma es iOS.
 */
function lib(): HealthKitLib {
  return require('@kingstinct/react-native-healthkit');
}

/**
 * Tipos de los que la app pide permiso de LECTURA. Cualquier tipo nuevo que se lea más
 * adelante (p. ej. HRV para la recuperación) debe agregarse aquí, o la lectura crashea.
 */
const READ_TYPES = [
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierStepCount',
  'HKWorkoutTypeIdentifier',
] as const;

/** Se pone en `true` en cuanto sabemos que los permisos ya se pidieron (evita reconsultar). */
let permissionsRequested = false;

// ── Estado y permisos ────────────────────────────────────────────────────────

/** Estado actual de la conexión con Apple Health. Nunca lanza. */
export async function getHealthStatus(): Promise<HealthStatus> {
  if (Platform.OS !== 'ios') return 'unsupported';
  try {
    const hk = lib();
    if (!(await hk.isHealthDataAvailableAsync())) return 'unavailable';
    if (permissionsRequested) return 'ready';

    // `unnecessary` = ya se mostró la hoja de permisos para todos estos tipos.
    const request = await hk.getRequestStatusForAuthorization({ toRead: READ_TYPES });
    if (request === hk.AuthorizationRequestStatus.unnecessary) {
      permissionsRequested = true;
      return 'ready';
    }
    return 'needs-permission';
  } catch {
    return 'unavailable';
  }
}

/**
 * Muestra la hoja de permisos de iOS (solo lectura). Si el usuario ya respondió antes, iOS no
 * la vuelve a mostrar: para cambiar la decisión hay que ir a Ajustes ▸ Salud ▸ Acceso a datos
 * y dispositivos ▸ gym-app. El resultado `requested` NO garantiza que se haya concedido.
 */
export async function requestPermissions(): Promise<RequestPermissionsResult> {
  if (Platform.OS !== 'ios') return { status: 'unsupported' };
  try {
    const hk = lib();
    if (!(await hk.isHealthDataAvailableAsync())) return { status: 'unavailable' };
    await hk.requestAuthorization({ toRead: READ_TYPES });
    permissionsRequested = true;
    return { status: 'requested' };
  } catch (error) {
    return { status: 'error', message: describeError(error) };
  }
}

/** Devuelve la librería solo si es seguro consultar; `null` en cualquier otro caso. */
async function ready(): Promise<HealthKitLib | null> {
  return (await getHealthStatus()) === 'ready' ? lib() : null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Filtro de fechas en el formato de la librería. */
function dateFilter({ start, end }: DateRange) {
  return { date: { startDate: start, endDate: end } };
}

/** Origen de una muestra: app que la escribió y dispositivo, si lo informa. */
function originOf(sample: {
  sourceRevision: { source: { name: string } };
  device?: { name?: string; model?: string };
}): Pick<TimedSample, 'source' | 'device'> {
  return {
    source: sample.sourceRevision.source.name,
    device: sample.device?.name ?? sample.device?.model ?? null,
  };
}

export function startOfToday(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function hoursAgo(hours: number, now = new Date()): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

// ── Lecturas ─────────────────────────────────────────────────────────────────

/**
 * Frecuencia cardíaca en un rango: las últimas `sampleLimit` muestras (con fuente) más
 * promedio/mín/máx calculados por HealthKit sobre TODO el rango.
 */
export async function readHeartRate(range: DateRange, sampleLimit = 20): Promise<HeartRateReading> {
  const hk = await ready();
  if (!hk) return { samples: [], averageBpm: null, minBpm: null, maxBpm: null };

  const id = 'HKQuantityTypeIdentifierHeartRate';
  const filter = dateFilter(range);
  // HealthKit guarda la FC en count/s; se pide explícitamente en latidos por minuto.
  const [samples, stats] = await Promise.all([
    hk.queryQuantitySamples(id, { filter, limit: sampleLimit, ascending: false, unit: 'count/min' }),
    hk.queryStatisticsForQuantity(id, ['discreteAverage', 'discreteMin', 'discreteMax'], {
      filter,
      unit: 'count/min',
    }),
  ]);

  return {
    samples: samples.map(toHeartRateSample),
    averageBpm: stats.averageQuantity?.quantity ?? null,
    minBpm: stats.minimumQuantity?.quantity ?? null,
    maxBpm: stats.maximumQuantity?.quantity ?? null,
  };
}

/** FC en reposo (la calcula el dispositivo, normalmente una vez al día). Más reciente primero. */
export async function readRestingHeartRate(
  range: DateRange,
  sampleLimit = 10,
): Promise<RestingHeartRateReading> {
  const hk = await ready();
  if (!hk) return { samples: [], latest: null };

  const samples = await hk.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
    filter: dateFilter(range),
    limit: sampleLimit,
    ascending: false,
    unit: 'count/min',
  });
  const mapped = samples.map(toHeartRateSample);
  return { samples: mapped, latest: mapped[0] ?? null };
}

function toHeartRateSample(sample: {
  quantity: number;
  startDate: Date;
  endDate: Date;
  sourceRevision: { source: { name: string } };
  device?: { name?: string; model?: string };
}): HeartRateSample {
  return {
    bpm: sample.quantity,
    start: sample.startDate,
    end: sample.endDate,
    ...originOf(sample),
  };
}

/** Segmentos de sueño crudos (una entrada por etapa y fuente), en orden cronológico. */
export async function readSleepSegments(range: DateRange): Promise<SleepSegment[]> {
  const hk = await ready();
  if (!hk) return [];

  const samples = await hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    filter: dateFilter(range),
    limit: 0, // 0 = sin límite
    ascending: true,
  });

  const segments: SleepSegment[] = [];
  for (const sample of samples) {
    const stage = toSleepStage(hk, sample.value);
    if (!stage) continue;
    segments.push({ stage, start: sample.startDate, end: sample.endDate, ...originOf(sample) });
  }
  return segments;
}

function toSleepStage(hk: HealthKitLib, value: number): SleepStage | null {
  const values = hk.CategoryValueSleepAnalysis;
  switch (value) {
    case values.inBed:
      return 'inBed';
    case values.awake:
      return 'awake';
    case values.asleepCore:
      return 'core';
    case values.asleepDeep:
      return 'deep';
    case values.asleepREM:
      return 'rem';
    case values.asleepUnspecified:
      return 'asleepUnspecified';
    default:
      return null; // valor futuro desconocido: se ignora en vez de fallar
  }
}

/** "Sueño de anoche": duración y etapas del bloque de sueño sustancial más reciente. */
export async function readLastNight(now = new Date()): Promise<SleepNight | null> {
  // 36 h cubre desde la tarde de ayer aunque se consulte a media tarde de hoy.
  const segments = await readSleepSegments({ start: hoursAgo(36, now), end: now });
  return pickLastNight(segments);
}

/**
 * Calorías activas acumuladas en un rango. HealthKit combina las fuentes por prioridad para
 * no contar dos veces lo mismo, así que puede diferir de lo que muestra la app del Fitbit.
 */
export async function readActiveEnergy(range: DateRange): Promise<SumReading> {
  return readSum('HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal', range);
}

/** Pasos acumulados en un rango (mismas reglas de combinación de fuentes que las calorías). */
export async function readSteps(range: DateRange): Promise<SumReading> {
  return readSum('HKQuantityTypeIdentifierStepCount', 'count', range);
}

async function readSum(
  id: 'HKQuantityTypeIdentifierActiveEnergyBurned' | 'HKQuantityTypeIdentifierStepCount',
  unit: 'kcal' | 'count',
  range: DateRange,
): Promise<SumReading> {
  const hk = await ready();
  if (!hk) return { total: 0, unit, sources: [] };

  const stats = await hk.queryStatisticsForQuantity(id, ['cumulativeSum'], {
    filter: dateFilter(range),
    unit,
  });
  return {
    total: stats.sumQuantity?.quantity ?? 0,
    unit,
    sources: stats.sources.map((source) => source.name),
  };
}

/** Entrenamientos en un rango, el más reciente primero. */
export async function readWorkouts(range: DateRange, limit = 5): Promise<WorkoutSummary[]> {
  const hk = await ready();
  if (!hk) return [];

  const workouts = await hk.queryWorkoutSamples({
    filter: dateFilter(range),
    limit,
    ascending: false,
  });

  return Promise.all(
    workouts.map(async (workout): Promise<WorkoutSummary> => {
      // FC durante el entrenamiento (clave para medir intensidad en días funcionales).
      let avgHeartRateBpm: number | null = null;
      let maxHeartRateBpm: number | null = null;
      try {
        const stats = await workout.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min');
        avgHeartRateBpm = stats?.averageQuantity?.quantity ?? null;
        maxHeartRateBpm = stats?.maximumQuantity?.quantity ?? null;
      } catch {
        // Sin datos de FC dentro del entrenamiento: se deja en null.
      }

      return {
        id: workout.uuid,
        activityType: hk.WorkoutActivityType[workout.workoutActivityType] ?? String(workout.workoutActivityType),
        start: workout.startDate,
        end: workout.endDate,
        // La librería entrega la duración en segundos, la energía en kcal y la distancia en metros.
        durationMinutes: Math.round(workout.duration.quantity / 60),
        activeEnergyKcal: workout.totalEnergyBurned?.quantity ?? null,
        distanceMeters: workout.totalDistance?.quantity ?? null,
        avgHeartRateBpm,
        maxHeartRateBpm,
        ...originOf(workout),
      };
    }),
  );
}

// ── Foto completa (pantalla de verificación) ─────────────────────────────────

async function metric<T>(read: () => Promise<T>): Promise<Metric<T>> {
  try {
    return { ok: true, data: await read() };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

/** Lee todas las métricas a la vez; cada una falla de forma independiente. */
export async function readHealthSnapshot(now = new Date()): Promise<HealthSnapshot> {
  const today: DateRange = { start: startOfToday(now), end: now };
  const [heartRate, restingHeartRate, sleep, activeEnergyToday, stepsToday, lastWorkout] =
    await Promise.all([
      metric(() => readHeartRate({ start: hoursAgo(24, now), end: now })),
      metric(() => readRestingHeartRate({ start: hoursAgo(48, now), end: now })),
      metric(() => readLastNight(now)),
      metric(() => readActiveEnergy(today)),
      metric(() => readSteps(today)),
      metric(async () => (await readWorkouts({ start: hoursAgo(14 * 24, now), end: now }, 1))[0] ?? null),
    ]);

  return { fetchedAt: now, heartRate, restingHeartRate, sleep, activeEnergyToday, stepsToday, lastWorkout };
}

// ── Datos para el Fit Score ──────────────────────────────────────────────────

/**
 * Lee de una vez lo que necesita el Fit Score: sueño y FC en reposo de `range` (semana evaluada
 * más su referencia previa) y los entrenamientos desde `workoutsFrom` (para estimar la FC máx.).
 * Devuelve `null` si HealthKit no está listo; el motor entonces puntúa sin esas señales.
 */
export async function readScoreHealthData(
  range: DateRange,
  workoutsFrom: Date,
): Promise<HealthWeekData | null> {
  const hk = await ready();
  if (!hk) return null;

  const [segments, restingHr, workouts] = await Promise.all([
    readSleepSegments(range),
    readRestingHeartRate(range, 200),
    readWorkouts({ start: workoutsFrom, end: range.end }, 60),
  ]);
  return { nights: buildNights(segments), restingHr: restingHr.samples, workouts };
}
