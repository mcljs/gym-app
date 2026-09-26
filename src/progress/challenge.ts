/**
 * "Reto del día": qué propone la app para romper una meseta o completar tu base de fuerza.
 * Prioridad: 1) el ejercicio más estancado; 2) un levantamiento base sin historial.
 * El reto no caduca: sigue igual hasta que superes el número (o registres el levantamiento).
 */
import { FOUNDATIONAL_LIFTS, MIN_LIFTS_FOR_BASELINE } from './config';
import type { Challenge, LiftSummary } from './types';

export function pickChallenge(
  lifts: readonly LiftSummary[],
  foundational: readonly string[] = FOUNDATIONAL_LIFTS,
): Challenge | null {
  const stalest = lifts
    .filter((lift) => lift.stale)
    .sort((a, b) => b.weeksSincePr - a.weeksSincePr)[0];
  if (stalest) {
    return {
      kind: 'stale',
      exerciseSlug: stalest.exerciseSlug,
      weeksStale: stalest.weeksSincePr,
      best: stalest.best,
      liftKind: stalest.kind,
      toBeat: stalest.toBeat,
    };
  }

  // Sin suficiente historial no tiene sentido pedir levantamientos base (recién empiezas).
  if (lifts.length >= MIN_LIFTS_FOR_BASELINE) {
    const tracked = new Set(lifts.map((lift) => lift.exerciseSlug));
    const missing = foundational.find((slug) => !tracked.has(slug));
    if (missing) return { kind: 'baseline', exerciseSlug: missing };
  }
  return null;
}
