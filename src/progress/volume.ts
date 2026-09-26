/**
 * Volumen semanal: series duras por grupo muscular en una semana, contra la banda de
 * hipertrofia (10–20). Solo cuentan las sesiones de fuerza. Función pura.
 */
import { endOfWeek, toDateKey } from '@/lib/dates';
import type { Session } from '@/types';

import {
  HARD_SET_MIN_REPS,
  VOLUME_GROUPS,
  VOLUME_MAX_SETS,
  VOLUME_MIN_SETS,
  type VolumeGroupId,
} from './config';
import type { VolumeRow, VolumeStatus } from './types';

/**
 * @param groupOf resuelve el grupo de volumen de un ejercicio (por su slug); `null` si no suma.
 *                Se inyecta para que este módulo no dependa del catálogo.
 */
export function weeklyVolume(
  sessions: readonly Session[],
  weekStart: Date,
  groupOf: (exerciseSlug: string) => VolumeGroupId | null,
): VolumeRow[] {
  const startKey = toDateKey(weekStart);
  const endKey = toDateKey(endOfWeek(weekStart));
  const counts = new Map<VolumeGroupId, number>();

  for (const session of sessions) {
    if (session.dayType !== 'fuerza' || session.date < startKey || session.date > endKey) continue;
    for (const exercise of session.exercises) {
      const group = groupOf(exercise.exerciseSlug);
      if (!group) continue;
      const hardSets = exercise.sets.filter((s) => s.reps >= HARD_SET_MIN_REPS).length;
      counts.set(group, (counts.get(group) ?? 0) + hardSets);
    }
  }

  return VOLUME_GROUPS.map((group) => {
    const sets = counts.get(group.id) ?? 0;
    const status: VolumeStatus = !group.evaluated
      ? 'sin objetivo'
      : sets < VOLUME_MIN_SETS
        ? 'bajo'
        : sets > VOLUME_MAX_SETS
          ? 'alto'
          : 'en rango';
    return {
      group: group.id,
      label: group.label,
      sets,
      status,
      missing: status === 'bajo' ? VOLUME_MIN_SETS - sets : 0,
    };
  });
}
