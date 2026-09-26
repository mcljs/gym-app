import { useMemo } from 'react';

import { analyzeLifts } from '@/progress/lifts';
import { useWorkoutStore } from '@/store/useWorkoutStore';

import { useToday } from './useToday';

/** Resumen de cada ejercicio de fuerza (PRs, estancados, historial). Se recalcula al cambiar el log. */
export function useLifts() {
  const sessions = useWorkoutStore((s) => s.sessions);
  const { now } = useToday();
  return useMemo(() => analyzeLifts(sessions, now), [sessions, now]);
}
