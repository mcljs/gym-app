/**
 * Modelo de datos de la app.
 *
 * Separa DOS conceptos que nunca deben mezclarse:
 *  - PLANTILLA (RoutineTemplate): mi plan por día de la semana. Editable y persistente.
 *  - SESIÓN (Session): lo que realmente hice un día concreto. Nace COPIANDO la plantilla
 *    y desde ese momento es independiente: editarla no toca la plantilla, y editar la
 *    plantilla no toca sesiones ya creadas.
 *
 * Decisiones pensadas para las fases siguientes (nada de esto se calcula todavía):
 *  - Los ejercicios se referencian SIEMPRE por `slug` (id estable del catálogo). Así la
 *    progresión de carga (Fase 2) se puede seguir por ejercicio a lo largo del tiempo.
 *  - `Session.dayType` ('fuerza' | 'funcional') queda congelado en la sesión: el Fit Score
 *    pondera distinto según el tipo de día (fuerza → carga/progresión; funcional →
 *    HR/tiempo/calorías) y no debe cambiar si luego edito la plantilla.
 *  - `Session.startedAt` / `finishedAt` (ISO con hora) delimitan la ventana de tiempo con la
 *    que se cruzarán los datos de HealthKit (HR, calorías) en la Fase 2.
 *  - `LoggedExercise.target` guarda el objetivo tal como estaba al iniciar la sesión, para
 *    poder comparar "lo que planeé" vs "lo que hice" aunque la plantilla cambie después.
 *  - Peso corporal (Fase 2) y nutrición (Fase 3) irán como colecciones nuevas en el store,
 *    con su propia fecha; no requieren tocar estos tipos.
 */

/** Tipo de ejercicio / de sesión. Es la clave para ponderar el Fit Score en Fase 2. */
export type ExerciseKind = 'fuerza' | 'funcional';

/** Tipo de día en la plantilla: además de entrenar, un día puede ser de descanso. */
export type DayType = ExerciseKind | 'descanso';

/** Día de la semana ISO-8601: 1 = lunes … 7 = domingo. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Ejercicio del catálogo (proyección de lo que expone `@bryllim/workout-guide`). */
export interface Exercise {
  /** Id estable. Es el mismo slug del paquete de ejercicios. */
  slug: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: ExerciseKind;
}

/** Objetivo de trabajo: series y rango de repeticiones. */
export interface RepTarget {
  sets: number;
  repsMin: number;
  repsMax: number;
}

/** Ejercicio dentro de un día de la plantilla, con su objetivo. */
export interface ExerciseTarget extends RepTarget {
  /** Id propio (no el slug) para poder reordenar/quitar sin ambigüedad. */
  id: string;
  exerciseSlug: string;
}

export interface RoutineDayTemplate {
  weekday: Weekday;
  dayType: DayType;
  targets: ExerciseTarget[];
}

/** Plantilla completa: los 7 días. Es la fuente de verdad y vive en el store. */
export type RoutineTemplate = Record<Weekday, RoutineDayTemplate>;

export interface LoggedSet {
  id: string;
  weightKg: number;
  reps: number;
  /**
   * Set "as many reps as possible" (al fallo). Como es esfuerzo máximo, el Fit Score compara
   * los AMRAP entre semanas de forma más fiable que un set normal. Opcional: los sets
   * guardados antes de existir este campo no lo tienen y se tratan como `false`.
   */
  isAmrap?: boolean;
}

/** Registro manual de peso corporal (Fase 2: señal de tendencia de peso del Fit Score). */
export interface BodyWeightEntry {
  id: string;
  /** Fecha LOCAL 'YYYY-MM-DD'. Una entrada por día (registrar de nuevo el mismo día la reemplaza). */
  date: string;
  weightKg: number;
}

export interface LoggedExercise {
  id: string;
  exerciseSlug: string;
  /** Objetivo copiado de la plantilla al iniciar; `null` si lo agregué ese mismo día. */
  target: RepTarget | null;
  sets: LoggedSet[];
}

export interface Session {
  id: string;
  /** Fecha LOCAL en formato 'YYYY-MM-DD'. Una sesión por día. */
  date: string;
  weekday: Weekday;
  /** Sin 'descanso': una sesión siempre es un entrenamiento. */
  dayType: ExerciseKind;
  /** ISO con hora; inicio de la ventana de tiempo para cruzar con HealthKit. */
  startedAt: string;
  /** ISO con hora al guardar; `null` mientras la sesión sigue en curso. */
  finishedAt: string | null;
  exercises: LoggedExercise[];
}
