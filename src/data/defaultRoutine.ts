/**
 * PLANTILLA INICIAL — SOLO UN VALOR DE ARRANQUE.
 *
 * Esto NO es la rutina fija de la app. Se usa una única vez: la primera vez que se crea el
 * store, para no arrancar con la semana vacía. A partir de ahí la plantilla real vive en el
 * store (persistida en AsyncStorage) y la edita el usuario desde la pantalla "Mi rutina".
 * Cambiar este archivo NO afecta a una plantilla que ya se haya guardado.
 *
 * Es una función (y no una constante) para generar ids nuevos en cada llamada.
 */
import { newId } from '@/lib/id';
import type { DayType, ExerciseTarget, RoutineDayTemplate, RoutineTemplate, Weekday } from '@/types';

function target(exerciseSlug: string, sets: number, repsMin: number, repsMax: number): ExerciseTarget {
  return { id: newId(), exerciseSlug, sets, repsMin, repsMax };
}

function day(weekday: Weekday, dayType: DayType, targets: ExerciseTarget[] = []): RoutineDayTemplate {
  return { weekday, dayType, targets };
}

export function createDefaultRoutine(): RoutineTemplate {
  return {
    // LUNES — funcional / EMOM: sentadilla, pecho, espalda, hombro.
    // (Ejercicios elegidos por ser cómodos en EMOM; cámbialos desde la app si prefieres otros.)
    1: day(1, 'funcional', [
      target('goblet-squat', 4, 10, 12), // sentadilla
      target('push-up', 4, 10, 12), // pecho
      target('dumbbell-bent-over-row', 4, 10, 12), // espalda
      target('standing-dumbbell-press', 4, 10, 12), // hombro
    ]),

    // MARTES — fuerza: 3 de pecho (3-4 series × 7-9 reps) + 2 de bíceps (3 × 12-15).
    2: day(2, 'fuerza', [
      target('bench-press', 4, 7, 9),
      target('incline-dumbbell-press', 4, 7, 9),
      target('cable-fly', 3, 7, 9),
      target('preacher-curl', 3, 12, 15), // curl predicador
      target('hammer-curl', 3, 12, 15), // curl martillo
    ]),

    // MIÉRCOLES, JUEVES y VIERNES — días de entreno vacíos, listos para editar en la app.
    3: day(3, 'fuerza'),
    4: day(4, 'fuerza'),
    5: day(5, 'fuerza'),

    // SÁBADO y DOMINGO — descanso.
    6: day(6, 'descanso'),
    7: day(7, 'descanso'),
  };
}
