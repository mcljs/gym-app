/**
 * Configuración de PRs, ejercicios estancados, retos y volumen semanal.
 * Lo que quieras recalibrar (semanas para considerar un ejercicio estancado, banda de
 * volumen, lista de levantamientos base) se cambia aquí.
 */

/** Semanas sin superar tu mejor marca para considerar un ejercicio ESTANCADO. */
export const STALE_WEEKS = 8;

/** Un ejercicio solo puede estancarse si lo has entrenado al menos en tantas sesiones. */
export const MIN_SESSIONS_FOR_STALE = 3;

/** ...y si lo entrenaste hace menos de tantas semanas (si lo abandonaste, no es "estancado"). */
export const STALE_ACTIVE_WITHIN_WEEKS = 4;

/** Ventana (días) en la que un PR de repeticiones se muestra como "reciente". */
export const RECENT_REP_PR_DAYS = 28;

/** Incremento (kg) del número a superar en un reto. */
export const CHALLENGE_STEP_KG = 2.5;

/**
 * Levantamientos base para los retos de "línea base": si nunca has registrado uno de estos, el
 * reto te pide registrar una primera serie honesta. En orden de prioridad. Cambia la lista a
 * los que sí hagas.
 */
export const FOUNDATIONAL_LIFTS = [
  'squat',
  'bench-press',
  'deadlift',
  'overhead-press',
  'barbell-row',
  'romanian-deadlift',
  'front-squat',
  'pull-up',
] as const;

/** Ejercicios de fuerza distintos que hay que tener registrados antes de proponer retos de línea base. */
export const MIN_LIFTS_FOR_BASELINE = 3;

// ── Volumen semanal ─────────────────────────────────────────────────────────

/**
 * Sin RPE en el log no se pueden distinguir series duras de calentamientos, así que cuenta
 * como "serie dura" todo set registrado con al menos estas repeticiones.
 */
export const HARD_SET_MIN_REPS = 5;

/** Banda de series duras por músculo y semana para hipertrofia. */
export const VOLUME_MIN_SETS = 10;
export const VOLUME_MAX_SETS = 20;

export type VolumeGroupId =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'posterior';

export interface VolumeGroup {
  id: VolumeGroupId;
  label: string;
  /** `false` = se cuenta pero no se evalúa contra la banda (p. ej. cadena posterior: el peso muerto la trabaja con pocas series). */
  evaluated: boolean;
}

export const VOLUME_GROUPS: readonly VolumeGroup[] = [
  { id: 'chest', label: 'Pecho', evaluated: true },
  { id: 'back', label: 'Espalda', evaluated: true },
  { id: 'shoulders', label: 'Hombros', evaluated: true },
  { id: 'biceps', label: 'Bíceps', evaluated: true },
  { id: 'triceps', label: 'Tríceps', evaluated: true },
  { id: 'quads', label: 'Cuádriceps', evaluated: true },
  { id: 'hamstrings', label: 'Isquiotibiales', evaluated: true },
  { id: 'glutes', label: 'Glúteos', evaluated: true },
  { id: 'calves', label: 'Gemelos', evaluated: true },
  { id: 'posterior', label: 'Posterior', evaluated: false },
];

/**
 * Grupo de volumen de cada músculo principal del catálogo (`Exercise.muscleGroup`). Solo se
 * cuenta el músculo PRINCIPAL de cada ejercicio; los que no aparecen aquí (core, antebrazos,
 * movilidad…) no suman.
 */
export const MUSCLE_TO_VOLUME_GROUP: Readonly<Record<string, VolumeGroupId>> = {
  Chest: 'chest',
  Back: 'back',
  Lats: 'back',
  'Upper Back': 'back',
  Shoulders: 'shoulders',
  'Rear Delts': 'shoulders',
  Biceps: 'biceps',
  Triceps: 'triceps',
  Quads: 'quads',
  Hamstrings: 'hamstrings',
  Glutes: 'glutes',
  Calves: 'calves',
  'Posterior Chain': 'posterior',
  'Lower Back': 'posterior',
};
