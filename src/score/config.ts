/**
 * Configuración del Fit Score: TODOS los pesos, umbrales y curvas viven aquí.
 * Para recalibrar el score se cambian estos números; la lógica (`engine.ts`) no se toca.
 *
 * Convención de las curvas: una lista de puntos [entrada, puntaje 0-100]. El motor interpola
 * linealmente entre puntos y "recorta" fuera de los extremos (por debajo del primero devuelve
 * su puntaje; por encima del último, el suyo).
 */
import type { ExerciseKind } from '@/types';

import type { SignalId } from './types';

export type Curve = readonly (readonly [x: number, score: number])[];

/**
 * Peso de cada señal según el tipo de día. Cada fila suma 1.
 * El score semanal mezcla las dos filas según la proporción de sesiones de fuerza y
 * funcionales de esa semana (p. ej. 2 fuerza + 1 funcional → 2/3 de la fila fuerza).
 *
 *  - Fuerza: se juzga sobre todo por progresión de carga. La intensidad cardíaca no cuenta
 *    (en un día de pesas la FC dice poco).
 *  - Funcional (Hyrox/EMOM): se juzga sobre todo por intensidad (FC y calorías).
 */
export const DAY_TYPE_WEIGHTS: Record<ExerciseKind, Record<SignalId, number>> = {
  fuerza: { progression: 0.55, recovery: 0.25, intensity: 0, bodyWeight: 0.2 },
  funcional: { progression: 0.1, recovery: 0.3, intensity: 0.45, bodyWeight: 0.15 },
};

/** Mínimo de señales con datos para mostrar un score; con menos se muestra "faltan datos". */
export const MIN_SIGNALS = 2;

/** Ventana de referencia (días previos a la semana evaluada) para comparar tendencias. */
export const BASELINE_DAYS = 28;

/** Etiquetas del score, de mayor a menor umbral. */
export const SCORE_BANDS = [
  { min: 85, label: 'Excelente' },
  { min: 70, label: 'Buena' },
  { min: 55, label: 'Regular' },
  { min: 0, label: 'Floja' },
] as const;

// ── Progresión de carga ─────────────────────────────────────────────────────

/** Variación % de la fuerza estimada (1RM) vs. la referencia → puntaje. */
export const PROGRESSION_CURVE: Curve = [
  [-10, 20],
  [-2, 65],
  [0, 80], // mantener la carga es aceptable, pero no es progresar
  [2, 100],
];

/** Umbral (en %) para etiquetar un ejercicio como "progreso" o "retroceso". */
export const PROGRESSION_STATUS_PCT = 2;

/** Reps máximas que se usan en la fórmula de Epley; por encima, la estimación pierde fiabilidad. */
export const EPLEY_MAX_REPS = 15;

// ── Recuperación ────────────────────────────────────────────────────────────

/** Peso relativo de cada componente de la recuperación (se renormaliza si falta uno). */
export const RECOVERY_WEIGHTS = { sleep: 0.55, restingHr: 0.45 } as const;

/** Sueño promedio por noche (minutos dormidos) → puntaje. 7 h 30 min = objetivo. */
export const SLEEP_CURVE: Curve = [
  [300, 20],
  [360, 50],
  [420, 80],
  [450, 100],
];

/** Cambio de la FC en reposo (bpm) vs. tu promedio de las 4 semanas previas → puntaje. */
export const RESTING_HR_DELTA_CURVE: Curve = [
  [-2, 100],
  [0, 85],
  [3, 50],
  [6, 15],
];

/** Mínimo de mediciones de FC en reposo previas para tener una referencia fiable. */
export const MIN_BASELINE_RESTING_HR = 5;

// ── Intensidad (días funcionales) ───────────────────────────────────────────

/** Peso de la FC y del ritmo de calorías dentro del puntaje de intensidad de una sesión. */
export const INTENSITY_WEIGHTS = { hr: 0.7, energy: 0.3 } as const;

/** FC media de la sesión como fracción de tu FC máxima → puntaje. */
export const HR_FRACTION_CURVE: Curve = [
  [0.5, 10],
  [0.6, 40],
  [0.7, 70],
  [0.8, 100],
];

/** kcal/min de la sesión ÷ tu mediana de sesiones funcionales previas → puntaje. */
export const ENERGY_RATIO_CURVE: Curve = [
  [0.6, 40],
  [0.8, 70],
  [1.0, 100],
];

/** FC máx. usada si no hay suficiente historial para observarla (poco fiable: se avisa). */
export const DEFAULT_MAX_HR = 190;
/** Entrenamientos con FC necesarios para confiar en la FC máx. observada. */
export const MIN_WORKOUTS_FOR_MAX_HR = 3;
/** Días hacia atrás en los que se busca la FC máx. observada. */
export const MAX_HR_LOOKBACK_DAYS = 90;
/** Sesiones funcionales previas necesarias para tener una referencia de kcal/min. */
export const MIN_BASELINE_ENERGY_SESSIONS = 2;
/** Si una sesión no tiene hora de fin, se asume esta duración (min) para cruzarla con el reloj. */
export const ASSUMED_SESSION_MINUTES = 90;

// ── Peso corporal (meta actual: hipertrofia → ganar masa despacio) ──────────

/** Ventana (días) sobre la que se calcula la tendencia de peso. */
export const BODY_WEIGHT_WINDOW_DAYS = 28;
/** Registros mínimos y separación mínima (días) entre el primero y el último. */
export const MIN_BODY_WEIGHT_ENTRIES = 3;
export const MIN_BODY_WEIGHT_SPAN_DAYS = 10;

/**
 * Cambio de peso en % por semana → puntaje. Para ganar masa, +0.1 a +0.5 %/semana es la zona
 * ideal; estancarse puntúa medio, perder peso o subir muy rápido (más grasa) puntúa bajo.
 */
export const BODY_WEIGHT_CURVE: Curve = [
  [-1.0, 15],
  [-0.3, 40],
  [0, 65],
  [0.1, 100],
  [0.5, 100],
  [0.8, 70],
  [1.5, 40],
];
