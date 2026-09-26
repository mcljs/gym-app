import { useEffect, useMemo, useState } from 'react';

import { getHealthStatus, readScoreHealthData } from '@/health/healthkit';
import type { HealthStatus, HealthWeekData } from '@/health/types';
import { addDays, endOfWeek, startOfWeek } from '@/lib/dates';
import { BASELINE_DAYS, MAX_HR_LOOKBACK_DAYS } from '@/score/config';
import { computeFitScore } from '@/score/engine';
import type { FitScore } from '@/score/types';
import { useWorkoutStore } from '@/store/useWorkoutStore';

import { useToday } from './useToday';

/**
 * Fit Score de una semana. `weekOffset` = 0 es la semana actual, −1 la anterior, etc.
 *
 * Los datos de HealthKit se leen una vez por semana pedida (y al refrescar); el score se
 * recalcula solo cada vez que cambia el log o el peso corporal, sin volver a leer HealthKit.
 * Devuelve `fitScore = null` mientras se leen los datos de salud.
 */
export function useFitScore(weekOffset: number) {
  const sessions = useWorkoutStore((s) => s.sessions);
  const bodyWeights = useWorkoutStore((s) => s.bodyWeights);
  const { now } = useToday();

  const weekStartMs = startOfWeek(addDays(now, weekOffset * 7)).getTime();
  const [reloadCount, setReloadCount] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    health: HealthWeekData | null;
    healthStatus: HealthStatus;
  } | null>(null);

  // La clave identifica "qué semana / qué lectura"; si no coincide con lo cargado, se está leyendo.
  const key = `${weekStartMs}:${reloadCount}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const weekStart = new Date(weekStartMs);
      const readNow = new Date();
      const end = new Date(Math.min(readNow.getTime(), endOfWeek(weekStart).getTime()));
      const healthStatus = await getHealthStatus();
      const health =
        healthStatus === 'ready'
          ? await readScoreHealthData(
              // Semana evaluada + su referencia previa (con 1 día de margen por las noches).
              { start: addDays(weekStart, -(BASELINE_DAYS + 1)), end },
              addDays(end, -MAX_HR_LOOKBACK_DAYS),
            ).catch(() => null)
          : null;
      if (!cancelled) setLoaded({ key: `${weekStartMs}:${reloadCount}`, health, healthStatus });
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStartMs, reloadCount]);

  const current = loaded !== null && loaded.key === key ? loaded : null;

  const fitScore: FitScore | null = useMemo(
    () =>
      current
        ? computeFitScore({
            weekStart: new Date(weekStartMs),
            now,
            sessions,
            bodyWeights,
            health: current.health,
          })
        : null,
    [current, weekStartMs, now, sessions, bodyWeights],
  );

  return {
    fitScore,
    loading: current === null,
    healthStatus: current?.healthStatus ?? null,
    weekStart: new Date(weekStartMs),
    refresh: () => setReloadCount((n) => n + 1),
  };
}
