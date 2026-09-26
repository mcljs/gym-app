/**
 * Store principal (Zustand + persistencia en AsyncStorage).
 *
 * Guarda tres colecciones independientes:
 *  - `template`: la PLANTILLA semanal (fuente de verdad, editable). El seed solo la inicializa
 *    la primera vez.
 *  - `sessions`: las SESIONES registradas (lo que realmente hice).
 *  - `bodyWeights`: registro manual de peso corporal (una entrada por día).
 *
 * Regla de oro: las acciones de sesión NUNCA modifican `template`, y las de plantilla NUNCA
 * modifican `sessions`. Al iniciar una sesión se copia la plantilla generando ids nuevos, así
 * que ambas quedan completamente desacopladas.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createDefaultRoutine } from '@/data/defaultRoutine';
import { getIsoWeekday, toDateKey } from '@/lib/dates';
import { newId } from '@/lib/id';
import type {
  BodyWeightEntry,
  DayType,
  ExerciseTarget,
  LoggedExercise,
  LoggedSet,
  RepTarget,
  RoutineDayTemplate,
  RoutineTemplate,
  Session,
  Weekday,
} from '@/types';

/** Objetivo por defecto al agregar un ejercicio a la plantilla (rango típico de hipertrofia). */
const DEFAULT_TARGET: RepTarget = { sets: 3, repsMin: 8, repsMax: 12 };

/** Repeticiones con las que arranca el primer set si no hay historial ni objetivo. */
const FALLBACK_REPS = 8;

const clampInt = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));

const nonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Rango razonable para un peso corporal en kg; fuera de él se ignora la entrada. */
const MIN_BODY_KG = 20;
const MAX_BODY_KG = 400;

interface WorkoutState {
  template: RoutineTemplate;
  sessions: Session[];
  bodyWeights: BodyWeightEntry[];

  // ── Plantilla ──────────────────────────────────────────────────────────────
  setDayType: (weekday: Weekday, dayType: DayType) => void;
  addTarget: (weekday: Weekday, exerciseSlug: string) => void;
  removeTarget: (weekday: Weekday, targetId: string) => void;
  /** Mueve un ejercicio una posición hacia arriba (-1) o abajo (+1). */
  moveTarget: (weekday: Weekday, targetId: string, offset: -1 | 1) => void;
  updateTarget: (weekday: Weekday, targetId: string, patch: Partial<RepTarget>) => void;

  // ── Sesión (nunca tocan la plantilla) ─────────────────────────────────────
  /**
   * Inicia la sesión de hoy copiando la plantilla del día. Es idempotente: si ya existe una
   * sesión de hoy devuelve su id. Devuelve `null` si hoy es día de descanso.
   */
  startTodaySession: (now?: Date) => string | null;
  addSessionExercise: (sessionId: string, exerciseSlug: string) => void;
  removeSessionExercise: (sessionId: string, exerciseId: string) => void;
  addSet: (sessionId: string, exerciseId: string) => void;
  updateSet: (
    sessionId: string,
    exerciseId: string,
    setId: string,
    patch: Partial<Pick<LoggedSet, 'weightKg' | 'reps' | 'isAmrap'>>,
  ) => void;
  removeSet: (sessionId: string, exerciseId: string, setId: string) => void;
  /** Guarda la sesión: marca la hora de fin. Sigue siendo editable. */
  finishSession: (sessionId: string) => void;
  reopenSession: (sessionId: string) => void;

  // ── Peso corporal ─────────────────────────────────────────────────────────
  /** Registra el peso de una fecha ('YYYY-MM-DD'). Si ya había uno ese día, lo reemplaza. */
  setBodyWeight: (date: string, weightKg: number) => void;
  removeBodyWeight: (entryId: string) => void;
}

// ── Helpers inmutables ────────────────────────────────────────────────────────

function mapDay(
  template: RoutineTemplate,
  weekday: Weekday,
  fn: (day: RoutineDayTemplate) => RoutineDayTemplate,
): RoutineTemplate {
  return { ...template, [weekday]: fn(template[weekday]) };
}

function mapSession(sessions: Session[], sessionId: string, fn: (s: Session) => Session): Session[] {
  return sessions.map((s) => (s.id === sessionId ? fn(s) : s));
}

function mapExercise(
  sessions: Session[],
  sessionId: string,
  exerciseId: string,
  fn: (e: LoggedExercise) => LoggedExercise,
): Session[] {
  return mapSession(sessions, sessionId, (s) => ({
    ...s,
    exercises: s.exercises.map((e) => (e.id === exerciseId ? fn(e) : e)),
  }));
}

/** Último set registrado de un ejercicio en sesiones anteriores (para precargar el primer set). */
function findLastSet(sessions: Session[], slug: string, excludeSessionId: string): LoggedSet | undefined {
  // `sessions` se agrega en orden cronológico, así que se recorre de la más reciente hacia atrás.
  for (let i = sessions.length - 1; i >= 0; i--) {
    const session = sessions[i];
    if (session.id === excludeSessionId) continue;
    for (const exercise of session.exercises) {
      if (exercise.exerciseSlug === slug && exercise.sets.length > 0) {
        return exercise.sets[exercise.sets.length - 1];
      }
    }
  }
  return undefined;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      template: createDefaultRoutine(),
      sessions: [],
      bodyWeights: [],

      setDayType: (weekday, dayType) =>
        // Los ejercicios se conservan al pasar a 'descanso' por si luego se revierte.
        set((state) => ({ template: mapDay(state.template, weekday, (d) => ({ ...d, dayType })) })),

      addTarget: (weekday, exerciseSlug) =>
        set((state) => ({
          template: mapDay(state.template, weekday, (d) => ({
            ...d,
            targets: [...d.targets, { id: newId(), exerciseSlug, ...DEFAULT_TARGET }],
          })),
        })),

      removeTarget: (weekday, targetId) =>
        set((state) => ({
          template: mapDay(state.template, weekday, (d) => ({
            ...d,
            targets: d.targets.filter((t) => t.id !== targetId),
          })),
        })),

      moveTarget: (weekday, targetId, offset) =>
        set((state) => ({
          template: mapDay(state.template, weekday, (d) => {
            const from = d.targets.findIndex((t) => t.id === targetId);
            const to = from + offset;
            if (from < 0 || to < 0 || to >= d.targets.length) return d;
            const targets = [...d.targets];
            [targets[from], targets[to]] = [targets[to], targets[from]];
            return { ...d, targets };
          }),
        })),

      updateTarget: (weekday, targetId, patch) =>
        set((state) => ({
          template: mapDay(state.template, weekday, (d) => ({
            ...d,
            targets: d.targets.map((t): ExerciseTarget => {
              if (t.id !== targetId) return t;
              const next = { ...t };
              if (patch.sets !== undefined) next.sets = clampInt(patch.sets, 1, 20);
              if (patch.repsMin !== undefined) next.repsMin = clampInt(patch.repsMin, 1, 100);
              if (patch.repsMax !== undefined) next.repsMax = clampInt(patch.repsMax, 1, 100);
              // El rango debe seguir siendo válido: el valor que no se tocó se ajusta.
              if (patch.repsMin !== undefined && next.repsMin > next.repsMax) next.repsMax = next.repsMin;
              if (patch.repsMax !== undefined && next.repsMax < next.repsMin) next.repsMin = next.repsMax;
              return next;
            }),
          })),
        })),

      startTodaySession: (now = new Date()) => {
        const { sessions, template } = get();
        const date = toDateKey(now);
        const existing = sessions.find((s) => s.date === date);
        if (existing) return existing.id;

        const weekday = getIsoWeekday(now);
        const { dayType, targets } = template[weekday];
        if (dayType === 'descanso') return null;

        // Copia de la plantilla: ids nuevos y objetivo "congelado" en la sesión.
        const session: Session = {
          id: newId(),
          date,
          weekday,
          dayType,
          startedAt: now.toISOString(),
          finishedAt: null,
          exercises: targets.map((t) => ({
            id: newId(),
            exerciseSlug: t.exerciseSlug,
            target: { sets: t.sets, repsMin: t.repsMin, repsMax: t.repsMax },
            sets: [],
          })),
        };
        set((state) => ({ sessions: [...state.sessions, session] }));
        return session.id;
      },

      addSessionExercise: (sessionId, exerciseSlug) =>
        set((state) => ({
          sessions: mapSession(state.sessions, sessionId, (s) => ({
            ...s,
            // Agregado solo a esta sesión: sin objetivo y sin tocar la plantilla.
            exercises: [...s.exercises, { id: newId(), exerciseSlug, target: null, sets: [] }],
          })),
        })),

      removeSessionExercise: (sessionId, exerciseId) =>
        set((state) => ({
          sessions: mapSession(state.sessions, sessionId, (s) => ({
            ...s,
            exercises: s.exercises.filter((e) => e.id !== exerciseId),
          })),
        })),

      addSet: (sessionId, exerciseId) =>
        set((state) => ({
          sessions: mapExercise(state.sessions, sessionId, exerciseId, (e) => {
            // Precarga: set anterior de esta sesión → último set histórico del ejercicio → valores base.
            const previous =
              e.sets[e.sets.length - 1] ?? findLastSet(state.sessions, e.exerciseSlug, sessionId);
            const next: LoggedSet = {
              id: newId(),
              weightKg: previous?.weightKg ?? 0,
              reps: previous?.reps ?? e.target?.repsMin ?? FALLBACK_REPS,
            };
            return { ...e, sets: [...e.sets, next] };
          }),
        })),

      updateSet: (sessionId, exerciseId, setId, patch) =>
        set((state) => ({
          sessions: mapExercise(state.sessions, sessionId, exerciseId, (e) => ({
            ...e,
            sets: e.sets.map((s) =>
              s.id === setId
                ? {
                    ...s,
                    ...(patch.weightKg !== undefined && { weightKg: nonNegative(patch.weightKg) }),
                    ...(patch.reps !== undefined && { reps: clampInt(patch.reps, 0, 999) }),
                    ...(patch.isAmrap !== undefined && { isAmrap: patch.isAmrap }),
                  }
                : s,
            ),
          })),
        })),

      removeSet: (sessionId, exerciseId, setId) =>
        set((state) => ({
          sessions: mapExercise(state.sessions, sessionId, exerciseId, (e) => ({
            ...e,
            sets: e.sets.filter((s) => s.id !== setId),
          })),
        })),

      finishSession: (sessionId) =>
        set((state) => ({
          sessions: mapSession(state.sessions, sessionId, (s) => ({
            ...s,
            finishedAt: new Date().toISOString(),
          })),
        })),

      reopenSession: (sessionId) =>
        set((state) => ({
          sessions: mapSession(state.sessions, sessionId, (s) => ({ ...s, finishedAt: null })),
        })),

      setBodyWeight: (date, weightKg) => {
        if (!Number.isFinite(weightKg) || weightKg < MIN_BODY_KG || weightKg > MAX_BODY_KG) return;
        set((state) => ({
          bodyWeights: [
            ...state.bodyWeights.filter((e) => e.date !== date),
            { id: newId(), date, weightKg },
          ].sort((a, b) => a.date.localeCompare(b.date)),
        }));
      },

      removeBodyWeight: (entryId) =>
        set((state) => ({ bodyWeights: state.bodyWeights.filter((e) => e.id !== entryId) })),
    }),
    {
      name: 'gym-app/workout',
      // Subir `version` y agregar `migrate` cuando cambie la forma de los datos guardados.
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Solo se persisten los datos, no las acciones. Un estado guardado antes de existir
      // `bodyWeights` no lo trae: zustand conserva el valor inicial ([]), así que no hace falta migrar.
      partialize: (state) => ({
        template: state.template,
        sessions: state.sessions,
        bodyWeights: state.bodyWeights,
      }),
    },
  ),
);

/**
 * `true` cuando el store ya leyó AsyncStorage. La lectura es asíncrona: hasta entonces el
 * store contiene el seed, y no se debe mostrar ni escribir nada basado en él.
 */
export function useStoreHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useWorkoutStore.persist.onFinishHydration(onChange),
    () => useWorkoutStore.persist.hasHydrated(),
    () => false,
  );
}
