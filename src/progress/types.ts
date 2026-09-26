/**
 * Tipos de PRs, estancados, retos y volumen. Datos planos y serializables (igual que el
 * `FitScore`), para poder pasárselos al coach de IA más adelante.
 */
import type { VolumeGroupId } from './config';

export interface SetPoint {
  weightKg: number;
  reps: number;
}

/** Lo mejor que hiciste en un ejercicio en una sesión concreta. */
export interface SessionPoint {
  date: string;
  /** 1RM estimado de la mejor serie. `null` en ejercicios de peso corporal (se mide por reps). */
  e1rm: number | null;
  topSet: SetPoint;
  /** `true` si esa sesión superó tu mejor marca anterior (la primera sesión cuenta como línea base). */
  isPr: boolean;
}

/** Más repeticiones con el mismo peso que la mejor vez anterior. */
export interface RepPr {
  date: string;
  weightKg: number;
  reps: number;
  previousBest: number;
}

export interface LiftSummary {
  exerciseSlug: string;
  /** 'weighted' se mide por 1RM estimado; 'bodyweight' (0 kg siempre), por repeticiones. */
  kind: 'weighted' | 'bodyweight';
  sessions: number;
  firstDate: string;
  lastDate: string;
  /** Fecha de tu última mejor marca. */
  lastPrDate: string;
  weeksSincePr: number;
  weeksSinceLast: number;
  /** Sin superar tu mejor marca en ≥ STALE_WEEKS semanas, pero sigues entrenándolo. */
  stale: boolean;
  /** Tu mejor marca. `value` es el 1RM (kg) o las repeticiones. `isTrue` = un máximo real de 1 rep. */
  best: { value: number; isTrue: boolean; set: SetPoint; date: string };
  /** Mejor serie de UNA repetición (1RM real). `null` si nunca hiciste un single. */
  trueOneRm: { weightKg: number; date: string } | null;
  /** Mejor 1RM ESTIMADO (Epley) a partir de series de 2+ repeticiones. */
  estimated: { e1rm: number; set: SetPoint; date: string } | null;
  /** Serie más pesada registrada. `null` en ejercicios de peso corporal. */
  heaviest: { weightKg: number; reps: number; date: string } | null;
  /** PRs de repeticiones de los últimos días (más reciente primero). */
  repPrs: RepPr[];
  /** Una marca concreta que superaría tu mejor (para retos). */
  toBeat: SetPoint;
  /** Una entrada por sesión, de la más antigua a la más reciente. */
  history: SessionPoint[];
}

export type Challenge =
  | {
      kind: 'stale';
      exerciseSlug: string;
      weeksStale: number;
      best: LiftSummary['best'];
      liftKind: LiftSummary['kind'];
      toBeat: SetPoint;
    }
  | { kind: 'baseline'; exerciseSlug: string };

export type VolumeStatus = 'bajo' | 'en rango' | 'alto' | 'sin objetivo';

export interface VolumeRow {
  group: VolumeGroupId;
  label: string;
  /** Series duras de la semana. */
  sets: number;
  status: VolumeStatus;
  /** Series que faltan para llegar al mínimo (0 si ya lo alcanza o no se evalúa). */
  missing: number;
}
