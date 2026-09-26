import { MUSCLE_TO_VOLUME_GROUP, type VolumeGroupId } from '@/progress/config';

import { getExercise } from './catalog';

/** Grupo de volumen de un ejercicio según su músculo principal en el catálogo (`null` si no suma). */
export function volumeGroupOf(exerciseSlug: string): VolumeGroupId | null {
  const muscle = getExercise(exerciseSlug)?.muscleGroup;
  return (muscle && MUSCLE_TO_VOLUME_GROUP[muscle]) || null;
}
