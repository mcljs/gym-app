/**
 * Tipos del Fit Score semanal.
 *
 * El resultado (`FitScore`) es datos planos y serializables: en la Fase 3 se pasa tal cual al
 * prompt del coach de IA. El motor calcula TODOS los números; la IA solo los narra.
 */
import type { BodyWeightEntry, Session } from '@/types';
import type { HealthWeekData } from '@/health/types';

export type SignalId = 'progression' | 'recovery' | 'intensity' | 'bodyWeight';

export type ScoreLabel = 'Excelente' | 'Buena' | 'Regular' | 'Floja';

/** Campos comunes a las cuatro señales. */
export interface SignalBase {
  id: SignalId;
  /** 0–100, o `null` si no hay datos suficientes. */
  score: number | null;
  available: boolean;
  /** Peso según la mezcla de tipos de día (las 4 señales suman 1). */
  baseWeight: number;
  /** Peso final tras redistribuir el de las señales sin datos (0 si no está disponible). */
  weight: number;
  /** Por qué no hay datos y qué hacer, en español. `null` si está disponible. */
  unavailableReason: string | null;
}

/** Un set representativo (el mejor) de un ejercicio. */
export interface SetRef {
  weightKg: number;
  reps: number;
}

export interface ExerciseProgress {
  exerciseSlug: string;
  status: 'progreso' | 'mantuvo' | 'retroceso';
  /** Variación % de la fuerza estimada (1RM) vs. la referencia. */
  deltaPct: number;
  score: number;
  /** 'amrap' si se comparó AMRAP contra AMRAP; 'todos' si se usaron todos los sets. */
  basis: 'amrap' | 'todos';
  /** Mejor set de esta semana y de la referencia (según `basis`). */
  current: SetRef;
  reference: SetRef;
}

export interface ProgressionSignal extends SignalBase {
  id: 'progression';
  /** Ejercicios de fuerza de esta semana que también tienen referencia previa. */
  exercises: ExerciseProgress[];
  /** Ejercicios de esta semana sin referencia (primera vez): no puntúan. */
  newExercises: string[];
}

export interface RecoverySignal extends SignalBase {
  id: 'recovery';
  sleep: {
    avgMinutes: number;
    nights: number;
    baselineAvgMinutes: number | null;
    /** Diferencia vs. tu promedio previo; negativo = dormiste menos. */
    deltaMinutes: number | null;
    score: number;
  } | null;
  restingHr: {
    avgBpm: number;
    baselineAvgBpm: number;
    /** Diferencia vs. tu promedio previo; positivo = FC en reposo más alta (peor recuperación). */
    deltaBpm: number;
    score: number;
  } | null;
}

export interface IntensitySession {
  sessionId: string;
  date: string;
  activityType: string;
  durationMinutes: number;
  avgHrBpm: number;
  maxHrBpm: number | null;
  /** FC media ÷ FC máxima de referencia. */
  hrFraction: number;
  kcal: number | null;
  kcalPerMin: number | null;
  /** kcal/min ÷ tu mediana previa; `null` si no hay referencia. */
  energyRatio: number | null;
  score: number;
}

export interface IntensitySignal extends SignalBase {
  id: 'intensity';
  maxHrBpm: number;
  /** 'observada' si sale de tus entrenamientos; 'estimada' si se usó el valor por defecto. */
  maxHrSource: 'observada' | 'estimada';
  sessions: IntensitySession[];
  /** Sesiones funcionales sin entrenamiento/FC en Apple Health que cruzar. */
  sessionsWithoutData: number;
}

export interface BodyWeightSignal extends SignalBase {
  id: 'bodyWeight';
  latestKg: number | null;
  entries: number;
  /** Cambio de peso a lo largo de la ventana de tendencia. */
  changeKg: number | null;
  /** Tendencia en % de peso corporal por semana (regresión lineal). */
  pctPerWeek: number | null;
}

export interface FitScore {
  /** Lunes y domingo de la semana evaluada ('YYYY-MM-DD'). */
  weekStart: string;
  weekEnd: string;
  /** `true` si la semana aún no termina: el score es provisional. */
  isPartial: boolean;
  /** Sesiones con sets registrados en la semana, por tipo. */
  sessions: { fuerza: number; funcional: number };
  /** Fracción de sesiones de fuerza (0–1) que decide la mezcla de pesos. */
  fuerzaShare: number;
  /** 0–100, o `null` si faltan datos (ver `missingReason`). */
  score: number | null;
  label: ScoreLabel | null;
  /** Suma de los pesos base de las señales disponibles (0–1): qué tan completo es el score. */
  coverage: number;
  missingReason: string | null;
  progression: ProgressionSignal;
  recovery: RecoverySignal;
  intensity: IntensitySignal;
  bodyWeight: BodyWeightSignal;
}

export interface ScoreInput {
  /** Lunes 00:00 (hora local) de la semana a evaluar. */
  weekStart: Date;
  now: Date;
  sessions: readonly Session[];
  bodyWeights: readonly BodyWeightEntry[];
  /** `null` si HealthKit no está disponible o no se han pedido permisos. */
  health: HealthWeekData | null;
}
