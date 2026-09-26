/**
 * Catálogo de ejercicios.
 *
 * La ÚNICA fuente de ejercicios e ilustraciones es `@bryllim/workout-guide` (302 ejercicios).
 * Este módulo solo adapta esos datos al modelo de la app (`Exercise`) y expone:
 *  - `CATALOG_SEED`: ejercicios curados, que el selector muestra como "Sugeridos".
 *  - `searchCatalog`: búsqueda sobre TODO el paquete (los nombres están en inglés).
 *  - `getExercise` / `getExerciseImageUrl`: resolución por slug.
 *
 * Alcance Fase 1: solo ejercicios por repeticiones (peso × reps). Los de duración o
 * distancia (plank, SkiErg, remo, farmer carry…) quedan fuera porque `LoggedSet` no tiene
 * tiempo/distancia todavía; se incorporan cuando la Fase 2 modele los días Hyrox.
 */
import {
  getAssetUrl,
  getExercise as getPackageExercise,
  searchExercises as searchPackage,
  type Exercise as PackageExercise,
  type ExerciseType,
} from '@bryllim/workout-guide';

import type { Exercise, ExerciseKind } from '@/types';

/** Tipos del paquete que se registran como peso × reps. */
const REP_BASED_TYPES: readonly ExerciseType[] = [
  'weight_reps',
  'bodyweight_reps',
  'assisted_bodyweight',
];

/**
 * El paquete no distingue fuerza/funcional, así que se marca aquí a mano.
 * Todo lo que no esté en esta lista se considera de 'fuerza'.
 */
const FUNCTIONAL_SLUGS = new Set([
  'burpee',
  'half-burpee',
  'squat-thrust',
  'kettlebell-swing',
  'jump-squat',
  'walking-lunge',
]);

/** Traducción de grupos musculares del paquete, solo para mostrar en la UI. */
const MUSCLE_LABELS: Record<string, string> = {
  Chest: 'Pecho',
  Shoulders: 'Hombros',
  'Rear Delts': 'Deltoides posterior',
  'Upper Back': 'Espalda alta',
  'Posterior Chain': 'Cadena posterior',
  Hamstrings: 'Isquiotibiales',
  Back: 'Espalda',
  Lats: 'Dorsales',
  Biceps: 'Bíceps',
  Quads: 'Cuádriceps',
  Glutes: 'Glúteos',
  Calves: 'Pantorrillas',
  Forearms: 'Antebrazos',
  Triceps: 'Tríceps',
  Core: 'Core',
  Legs: 'Piernas',
  'Lower Back': 'Lumbar',
  Adductors: 'Aductores',
  Mobility: 'Movilidad',
  Hips: 'Cadera',
};

export function muscleLabel(muscleGroup: string): string {
  return MUSCLE_LABELS[muscleGroup] ?? muscleGroup;
}

function toExercise(pkg: PackageExercise): Exercise {
  const kind: ExerciseKind = FUNCTIONAL_SLUGS.has(pkg.slug) ? 'funcional' : 'fuerza';
  return {
    slug: pkg.slug,
    name: pkg.name,
    muscleGroup: pkg.primaryMuscle,
    equipment: pkg.equipment,
    kind,
  };
}

function isSupported(pkg: PackageExercise): boolean {
  return !pkg.isStretch && REP_BASED_TYPES.includes(pkg.exerciseType);
}

/** Resuelve un ejercicio por slug. `null` si el paquete ya no lo trae (rutinas guardadas antiguas). */
export function getExercise(slug: string): Exercise | null {
  const pkg = getPackageExercise(slug);
  return pkg ? toExercise(pkg) : null;
}

/** URL de la ilustración (frame 1 = pose inicial). `null` si el slug no existe. */
export function getExerciseImageUrl(slug: string, frame: 1 | 2 | 3 = 1): string | null {
  return getAssetUrl(slug, frame);
}

/**
 * Seed curado. Todos los slugs son REALES del paquete (verificados con `searchExercises`).
 * Agrupado por zona solo para facilitar la lectura.
 */
const SEED_SLUGS = [
  // Piernas
  'squat',
  'goblet-squat',
  'deadlift',
  'romanian-deadlift',
  'leg-press',
  'walking-lunge',
  // Pecho
  'bench-press',
  'incline-dumbbell-press',
  'cable-fly',
  'push-up',
  // Espalda
  'pull-up',
  'lat-pulldown',
  'barbell-row',
  'dumbbell-bent-over-row',
  // Hombro
  'overhead-press',
  'standing-dumbbell-press',
  'lateral-raise',
  // Brazos
  'bicep-curl',
  'hammer-curl',
  'preacher-curl',
  'tricep-pushdown',
  // Funcional
  'burpee',
  'kettlebell-swing',
];

export const CATALOG_SEED: Exercise[] = SEED_SLUGS.flatMap((slug) => {
  const exercise = getExercise(slug);
  if (!exercise) {
    // No debería pasar: si el paquete cambia un slug, avisa en desarrollo en vez de romper.
    if (__DEV__) console.warn(`[catalog] slug del seed no existe en el paquete: ${slug}`);
    return [];
  }
  return [exercise];
});

/**
 * Busca en TODO el paquete (solo ejercicios por repeticiones). Sin texto devuelve el seed.
 * Los nombres están en inglés, así que se busca en inglés ("curl", "row", "squat"…).
 */
export function searchCatalog(query: string, limit = 60): Exercise[] {
  const text = query.trim();
  if (!text) return CATALOG_SEED;
  return searchPackage(text).filter(isSupported).slice(0, limit).map(toExercise);
}
