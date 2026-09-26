/**
 * Análisis de cada ejercicio de FUERZA a lo largo del tiempo: mejor marca, 1RM real vs.
 * estimado, PRs de repeticiones y detección de ejercicios estancados.
 *
 * Solo cuentan las sesiones de fuerza (igual que la progresión del Fit Score): en los días
 * funcionales la carga es fija y no debería marcar "estancado" a un ejercicio.
 * Función pura: recibe las sesiones y devuelve datos, sin tocar el store.
 */
import { addDays, daysBetweenKeys, toDateKey } from '@/lib/dates';
import { epley1RM, round } from '@/score/math';
import type { LoggedSet, Session } from '@/types';

import {
  CHALLENGE_STEP_KG,
  MIN_SESSIONS_FOR_STALE,
  RECENT_REP_PR_DAYS,
  STALE_ACTIVE_WITHIN_WEEKS,
  STALE_WEEKS,
} from './config';
import type { LiftSummary, RepPr, SessionPoint, SetPoint } from './types';

interface DayEntry {
  date: string;
  sets: LoggedSet[];
}

/** Pesos en pasos de 0.25 kg se consideran "el mismo peso" (evita fallos de coma flotante). */
const weightKey = (kg: number) => Math.round(kg * 4) / 4;

const weeksBetween = (fromKey: string, toKey: string) => Math.floor(daysBetweenKeys(fromKey, toKey) / 7);

/** Un resumen por cada ejercicio de fuerza registrado. Estancados primero, luego por recencia. */
export function analyzeLifts(sessions: readonly Session[], now: Date): LiftSummary[] {
  const todayKey = toDateKey(now);
  const byExercise = new Map<string, DayEntry[]>();

  const chronological = sessions
    .filter((s) => s.dayType === 'fuerza')
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt));

  for (const session of chronological) {
    for (const exercise of session.exercises) {
      const sets = exercise.sets.filter((s) => s.reps > 0);
      if (sets.length === 0) continue;
      const entries = byExercise.get(exercise.exerciseSlug) ?? [];
      const last = entries[entries.length - 1];
      // Si el ejercicio aparece dos veces en la misma sesión, se junta en una sola entrada.
      if (last?.date === session.date) last.sets.push(...sets);
      else entries.push({ date: session.date, sets: [...sets] });
      byExercise.set(exercise.exerciseSlug, entries);
    }
  }

  const lifts: LiftSummary[] = [];
  for (const [slug, entries] of byExercise) {
    const lift = summarize(slug, entries, now, todayKey);
    if (lift) lifts.push(lift);
  }

  return lifts.sort(
    (a, b) =>
      Number(b.stale) - Number(a.stale) ||
      (a.stale && b.stale ? b.weeksSincePr - a.weeksSincePr : 0) ||
      b.lastDate.localeCompare(a.lastDate),
  );
}

function summarize(slug: string, entries: DayEntry[], now: Date, todayKey: string): LiftSummary | null {
  // Con carga se mide por 1RM estimado; si nunca hubo carga (dominadas, flexiones), por repeticiones.
  const weighted = entries.some((e) => e.sets.some((s) => s.weightKg > 0));
  const usable = (sets: LoggedSet[]) => (weighted ? sets.filter((s) => s.weightKg > 0) : sets);
  const metric = (s: LoggedSet) => (weighted ? epley1RM(s.weightKg, s.reps) : s.reps);
  const asPoint = (s: LoggedSet): SetPoint => ({ weightKg: s.weightKg, reps: s.reps });

  const history: SessionPoint[] = [];
  const repPrs: RepPr[] = [];
  const repBest = new Map<number, number>(); // mejores reps por peso, de sesiones ANTERIORES
  let runningBest = -Infinity;
  let lastPrDate = '';
  let trueOneRm: LiftSummary['trueOneRm'] = null;
  let estimated: LiftSummary['estimated'] = null;
  let heaviest: LiftSummary['heaviest'] = null;
  let bestSet: LoggedSet | null = null;
  let bestDate = '';

  for (const entry of entries) {
    const sets = usable(entry.sets);
    if (sets.length === 0) continue;

    const top = sets.reduce((a, b) => (metric(b) > metric(a) ? b : a));
    const isPr = metric(top) > runningBest + 1e-9;
    if (isPr) {
      runningBest = metric(top);
      lastPrDate = entry.date;
      bestSet = top;
      bestDate = entry.date;
    }
    history.push({
      date: entry.date,
      e1rm: weighted ? round(metric(top), 1) : null,
      topSet: asPoint(top),
      isPr,
    });

    if (!weighted) continue;

    for (const set of sets) {
      if (set.reps === 1 && (!trueOneRm || set.weightKg > trueOneRm.weightKg)) {
        trueOneRm = { weightKg: set.weightKg, date: entry.date };
      }
      const e1rm = epley1RM(set.weightKg, set.reps);
      if (set.reps >= 2 && (!estimated || e1rm > estimated.e1rm + 1e-9)) {
        estimated = { e1rm: round(e1rm, 1), set: asPoint(set), date: entry.date };
      }
      if (!heaviest || set.weightKg > heaviest.weightKg) {
        heaviest = { weightKg: set.weightKg, reps: set.reps, date: entry.date };
      }
    }

    // PR de repeticiones: más reps al mismo peso que en cualquier sesión anterior. Se compara
    // contra el historial ANTERIOR a esta sesión para que sus propias series no se "superen".
    const sessionBest = new Map<number, number>();
    for (const set of sets) {
      const key = weightKey(set.weightKg);
      sessionBest.set(key, Math.max(sessionBest.get(key) ?? 0, set.reps));
    }
    for (const [key, reps] of sessionBest) {
      const previous = repBest.get(key);
      if (previous !== undefined && reps > previous) {
        repPrs.push({ date: entry.date, weightKg: key, reps, previousBest: previous });
      }
      repBest.set(key, Math.max(previous ?? 0, reps));
    }
  }

  if (history.length === 0 || !bestSet) return null;

  const first = history[0].date;
  const last = history[history.length - 1].date;
  const weeksSincePr = weeksBetween(lastPrDate, todayKey);
  const weeksSinceLast = weeksBetween(last, todayKey);

  const trueRm = trueOneRm as LiftSummary['trueOneRm'];
  const estimate = estimated as LiftSummary['estimated'];
  // La mejor marca es el mayor entre el máximo real y el estimado; a igualdad gana el real.
  const bestIsTrue = weighted && trueRm !== null && (estimate === null || trueRm.weightKg >= estimate.e1rm);
  const bestValue = weighted ? (bestIsTrue ? trueRm!.weightKg : round(runningBest, 1)) : runningBest;

  const recentSince = toDateKey(addDays(now, -RECENT_REP_PR_DAYS));
  const bestPoint = asPoint(bestSet);

  return {
    exerciseSlug: slug,
    kind: weighted ? 'weighted' : 'bodyweight',
    sessions: history.length,
    firstDate: first,
    lastDate: last,
    lastPrDate,
    weeksSincePr,
    weeksSinceLast,
    stale:
      history.length >= MIN_SESSIONS_FOR_STALE &&
      weeksSincePr >= STALE_WEEKS &&
      weeksSinceLast <= STALE_ACTIVE_WITHIN_WEEKS,
    best: { value: bestValue, isTrue: bestIsTrue, set: bestIsTrue ? { weightKg: trueRm!.weightKg, reps: 1 } : bestPoint, date: bestIsTrue ? trueRm!.date : bestDate },
    trueOneRm: trueRm,
    estimated: estimate,
    heaviest: heaviest as LiftSummary['heaviest'],
    repPrs: repPrs.filter((pr) => pr.date >= recentSince).reverse(),
    toBeat: weighted
      ? { weightKg: bestPoint.weightKg + CHALLENGE_STEP_KG, reps: bestPoint.reps }
      : { weightKg: 0, reps: bestPoint.reps + 1 },
    history,
  };
}
