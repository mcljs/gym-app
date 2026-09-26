/**
 * Tipos públicos de la capa de salud.
 *
 * Son propios de la app y NO dependen de la librería de HealthKit: el resto del código
 * (pantallas, y más adelante el Fit Score) solo debe importar de `@/health/healthkit` y de
 * este archivo. Si algún día se cambia la librería, solo se reescribe `healthkit.ts`.
 */

/**
 * Estado de la conexión con Apple Health.
 *  - `unsupported`: no es iOS (web, Android, Expo Go sin build nativo…). Sin HealthKit.
 *  - `unavailable`: es iOS pero HealthKit no está disponible (p. ej. iPad, o falló el módulo).
 *  - `needs-permission`: aún no se ha mostrado la hoja de permisos.
 *  - `ready`: ya se pidieron los permisos; se puede leer.
 *
 * OJO: `ready` significa "ya se preguntó", NO "el usuario aceptó". iOS oculta a propósito si
 * se concedió el permiso de LECTURA (por privacidad). Si se negó, las consultas devuelven
 * vacío, igual que si no hubiera datos.
 */
export type HealthStatus = 'unsupported' | 'unavailable' | 'needs-permission' | 'ready';

export type RequestPermissionsResult =
  | { status: 'requested' }
  | { status: 'unsupported' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export interface DateRange {
  start: Date;
  end: Date;
}

/** Datos comunes a toda muestra: cuándo ocurrió y quién la escribió en Apple Health. */
export interface TimedSample {
  start: Date;
  end: Date;
  /** Nombre de la app/fuente que escribió el dato (p. ej. la app de Google Health/Fitbit). */
  source: string;
  /** Nombre del dispositivo si la fuente lo informa. */
  device: string | null;
}

export interface HeartRateSample extends TimedSample {
  bpm: number;
}

export interface HeartRateReading {
  /** Muestras más recientes primero (limitadas). */
  samples: HeartRateSample[];
  /** Estadísticas del rango completo (no solo de las muestras devueltas). */
  averageBpm: number | null;
  minBpm: number | null;
  maxBpm: number | null;
}

export interface RestingHeartRateReading {
  /** Más recientes primero. */
  samples: HeartRateSample[];
  latest: HeartRateSample | null;
}

export type SleepStage = 'inBed' | 'awake' | 'core' | 'deep' | 'rem' | 'asleepUnspecified';

export interface SleepSegment extends TimedSample {
  stage: SleepStage;
}

/** Una noche de sueño (el bloque de sueño "sustancial" más reciente). */
export interface SleepNight {
  start: Date;
  end: Date;
  minutesAsleep: number;
  minutesInBed: number;
  minutesAwake: number;
  /** Desglose de tiempo dormido. Con `asleepUnspecified` cuando la fuente no da etapas. */
  minutesByStage: { core: number; deep: number; rem: number; asleepUnspecified: number };
  /** `true` si la fuente reporta etapas (core/deep/REM), no solo "dormido". */
  hasStages: boolean;
  /** Fuente cuyos datos se usaron para los totales (evita sumar dos fuentes solapadas). */
  primarySource: string;
  otherSources: string[];
  /** Segmentos de la fuente principal, en orden cronológico. */
  segments: SleepSegment[];
}

/** Total acumulado de una magnitud (calorías activas, pasos) en un rango. */
export interface SumReading {
  total: number;
  unit: string;
  sources: string[];
}

export interface WorkoutSummary extends TimedSample {
  id: string;
  /** Nombre crudo del tipo de actividad de HealthKit, p. ej. 'functionalStrengthTraining'. */
  activityType: string;
  durationMinutes: number;
  activeEnergyKcal: number | null;
  distanceMeters: number | null;
  /** FC media/máx. durante el entrenamiento, si hay datos de FC dentro de su ventana. */
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
}

/** Resultado de una lectura individual: un fallo en una métrica no tumba a las demás. */
export type Metric<T> = { ok: true; data: T } | { ok: false; error: string };

/** Foto de todas las lecturas de la pantalla de verificación. */
export interface HealthSnapshot {
  fetchedAt: Date;
  /** Últimas 24 h. */
  heartRate: Metric<HeartRateReading>;
  /** Últimos 2 días. */
  restingHeartRate: Metric<RestingHeartRateReading>;
  /** Última noche (hasta 36 h atrás). `null` si no hay sueño registrado. */
  sleep: Metric<SleepNight | null>;
  /** Desde las 00:00 de hoy. */
  activeEnergyToday: Metric<SumReading>;
  /** Desde las 00:00 de hoy. */
  stepsToday: Metric<SumReading>;
  /** El más reciente de los últimos 14 días. `null` si no hay ninguno. */
  lastWorkout: Metric<WorkoutSummary | null>;
}

/**
 * Datos de salud que consume el Fit Score: un rango amplio (semana evaluada + referencia de
 * 4 semanas + historial de entrenamientos) que el motor filtra por sí mismo.
 */
export interface HealthWeekData {
  /** Noches de sueño sustanciales (≥ 3 h), de la más antigua a la más reciente. */
  nights: SleepNight[];
  /** Mediciones de FC en reposo, más recientes primero. */
  restingHr: HeartRateSample[];
  /** Entrenamientos con FC media/máx., más recientes primero. */
  workouts: WorkoutSummary[];
}
