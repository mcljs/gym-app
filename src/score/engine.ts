/**
 * Motor del Fit Score semanal. Función PURA: `ScoreInput` → `FitScore`.
 *
 * No accede a HealthKit ni al store (recibe los datos ya leídos), así que se prueba con datos
 * fabricados. Todos los pesos, umbrales y curvas están en `config.ts`.
 *
 * Cómo funciona:
 *  1. Cuatro señales de 0–100: progresión de carga, recuperación, intensidad y peso corporal.
 *  2. Cada señal tiene un peso que depende del TIPO DE DÍA: se mezclan los pesos de "fuerza" y
 *     "funcional" según la proporción de sesiones de cada tipo en la semana.
 *  3. Las señales sin datos se descartan y sus pesos se redistribuyen entre las que sí hay.
 *     Con menos de `MIN_SIGNALS` señales no se muestra score (mejor nada que uno engañoso).
 */
import type { HealthWeekData, WorkoutSummary } from '@/health/types';
import { addDays, daysBetweenKeys, endOfWeek, parseDateKey, toDateKey } from '@/lib/dates';
import type { LoggedSet, Session } from '@/types';

import {
  ASSUMED_SESSION_MINUTES,
  BASELINE_DAYS,
  BODY_WEIGHT_CURVE,
  BODY_WEIGHT_WINDOW_DAYS,
  DAY_TYPE_WEIGHTS,
  DEFAULT_MAX_HR,
  ENERGY_RATIO_CURVE,
  HR_FRACTION_CURVE,
  INTENSITY_WEIGHTS,
  MAX_HR_LOOKBACK_DAYS,
  MIN_BASELINE_ENERGY_SESSIONS,
  MIN_BASELINE_RESTING_HR,
  MIN_BODY_WEIGHT_ENTRIES,
  MIN_BODY_WEIGHT_SPAN_DAYS,
  MIN_SIGNALS,
  MIN_WORKOUTS_FOR_MAX_HR,
  PROGRESSION_CURVE,
  PROGRESSION_STATUS_PCT,
  RECOVERY_WEIGHTS,
  RESTING_HR_DELTA_CURVE,
  SCORE_BANDS,
  SLEEP_CURVE,
} from './config';
import { epley1RM, interpolate, linearSlope, mean, median, round } from './math';
import type {
  BodyWeightSignal,
  ExerciseProgress,
  FitScore,
  IntensitySession,
  IntensitySignal,
  ProgressionSignal,
  RecoverySignal,
  ScoreInput,
  SetRef,
  SignalBase,
  SignalId,
} from './types';

/** Fechas ya calculadas de la semana evaluada y de su ventana de referencia. */
interface Windows {
  weekStart: Date;
  /** Fin efectivo: `now` si la semana está en curso, o el domingo 23:59 si ya terminó. */
  windowEnd: Date;
  weekStartKey: string;
  weekEndKey: string;
  refStart: Date;
  refStartKey: string;
  now: Date;
}

const NO_HEALTH =
  'Conecta Apple Health (botón ♥ Salud en Hoy) para leer los datos del Fitbit.';

const emptyBase = (id: SignalId, baseWeight: number): SignalBase => ({
  id,
  score: null,
  available: false,
  baseWeight,
  weight: 0,
  unavailableReason: null,
});

const hasSets = (session: Session) => session.exercises.some((e) => e.sets.length > 0);

// ── Progresión de carga ──────────────────────────────────────────────────────

/**
 * Compara la mejor fuerza estimada de la semana contra la de las 4 semanas previas, por
 * ejercicio. Solo cuentan las sesiones de FUERZA (en las funcionales la carga es fija).
 *  - Con carga: 1RM estimado por Epley (peso × (1 + reps/30)).
 *  - Sin carga (peso corporal): se comparan las repeticiones.
 *  - Si hay AMRAP en ambos períodos se compara AMRAP contra AMRAP (esfuerzo máximo real).
 */
function computeProgression(
  sessions: readonly Session[],
  w: Windows,
  baseWeight: number,
): ProgressionSignal {
  const byExercise = new Map<string, { current: LoggedSet[]; reference: LoggedSet[] }>();

  for (const session of sessions) {
    if (session.dayType !== 'fuerza') continue;
    const inWeek = session.date >= w.weekStartKey && session.date <= w.weekEndKey;
    const inReference = session.date >= w.refStartKey && session.date < w.weekStartKey;
    if (!inWeek && !inReference) continue;

    for (const exercise of session.exercises) {
      const bucket = byExercise.get(exercise.exerciseSlug) ?? { current: [], reference: [] };
      const target = inWeek ? bucket.current : bucket.reference;
      for (const set of exercise.sets) if (set.reps > 0) target.push(set);
      byExercise.set(exercise.exerciseSlug, bucket);
    }
  }

  const exercises: ExerciseProgress[] = [];
  const newExercises: string[] = [];

  for (const [slug, { current, reference }] of byExercise) {
    if (current.length === 0) continue; // solo se evalúa lo entrenado esta semana
    const comparison = compareSets(current, reference);
    if (comparison) {
      exercises.push({ exerciseSlug: slug, ...comparison });
    } else if (reference.length === 0) {
      newExercises.push(slug);
    }
  }

  const signal: ProgressionSignal = { ...emptyBase('progression', baseWeight), id: 'progression', exercises, newExercises };
  if (exercises.length > 0) {
    signal.available = true;
    signal.score = round(mean(exercises.map((e) => e.score)));
  } else {
    signal.unavailableReason =
      newExercises.length > 0
        ? 'Todos los ejercicios de esta semana son nuevos: hacen falta datos de semanas previas para comparar.'
        : 'Sin sesiones de fuerza con sets en esta semana y las 4 previas para comparar.';
  }
  return signal;
}

function compareSets(
  current: readonly LoggedSet[],
  reference: readonly LoggedSet[],
): Omit<ExerciseProgress, 'exerciseSlug'> | null {
  // Si el ejercicio se hizo con carga en algún momento, solo cuentan los sets con carga.
  const weighted = [...current, ...reference].some((s) => s.weightKg > 0);
  const usable = (sets: readonly LoggedSet[]) => (weighted ? sets.filter((s) => s.weightKg > 0) : [...sets]);
  const strength = (s: LoggedSet) => (weighted ? epley1RM(s.weightKg, s.reps) : s.reps);
  const best = (sets: readonly LoggedSet[]) =>
    sets.reduce<LoggedSet | null>((top, s) => (top === null || strength(s) > strength(top) ? s : top), null);

  const cur = usable(current);
  const ref = usable(reference);
  const curAmrap = cur.filter((s) => s.isAmrap);
  const refAmrap = ref.filter((s) => s.isAmrap);
  const useAmrap = curAmrap.length > 0 && refAmrap.length > 0;

  const bestCurrent = best(useAmrap ? curAmrap : cur);
  const bestReference = best(useAmrap ? refAmrap : ref);
  if (!bestCurrent || !bestReference || strength(bestReference) <= 0) return null;

  const deltaPct = (strength(bestCurrent) / strength(bestReference) - 1) * 100;
  const status =
    deltaPct >= PROGRESSION_STATUS_PCT ? 'progreso' : deltaPct <= -PROGRESSION_STATUS_PCT ? 'retroceso' : 'mantuvo';
  const asRef = (s: LoggedSet): SetRef => ({ weightKg: s.weightKg, reps: s.reps });

  return {
    status,
    deltaPct: round(deltaPct, 1),
    score: round(interpolate(PROGRESSION_CURVE, deltaPct)),
    basis: useAmrap ? 'amrap' : 'todos',
    current: asRef(bestCurrent),
    reference: asRef(bestReference),
  };
}

// ── Recuperación ─────────────────────────────────────────────────────────────

/**
 * Sueño (minutos dormidos por noche) + FC en reposo (vs. tu propio promedio de las 4 semanas
 * previas: si sube, recuperas peor). Cada componente puntúa por separado y se combinan.
 */
function computeRecovery(health: HealthWeekData | null, w: Windows, baseWeight: number): RecoverySignal {
  const signal: RecoverySignal = {
    ...emptyBase('recovery', baseWeight),
    id: 'recovery',
    sleep: null,
    restingHr: null,
  };
  if (!health) {
    signal.unavailableReason = NO_HEALTH;
    return signal;
  }

  const inWeek = (d: Date) => d >= w.weekStart && d <= w.windowEnd;
  const inReference = (d: Date) => d >= w.refStart && d < w.weekStart;

  // Sueño: cada noche se asigna al día en que terminó (cuando te despiertas).
  const weekNights = health.nights.filter((n) => inWeek(n.end));
  if (weekNights.length > 0) {
    const referenceNights = health.nights.filter((n) => inReference(n.end));
    const avgMinutes = mean(weekNights.map((n) => n.minutesAsleep));
    const baselineAvg = referenceNights.length >= 3 ? mean(referenceNights.map((n) => n.minutesAsleep)) : null;
    signal.sleep = {
      avgMinutes: round(avgMinutes),
      nights: weekNights.length,
      baselineAvgMinutes: baselineAvg === null ? null : round(baselineAvg),
      deltaMinutes: baselineAvg === null ? null : round(avgMinutes - baselineAvg),
      score: round(interpolate(SLEEP_CURVE, avgMinutes)),
    };
  }

  // FC en reposo: necesita una referencia previa para que el cambio signifique algo.
  const weekHr = health.restingHr.filter((s) => inWeek(s.start));
  const referenceHr = health.restingHr.filter((s) => inReference(s.start));
  if (weekHr.length > 0 && referenceHr.length >= MIN_BASELINE_RESTING_HR) {
    const avgBpm = mean(weekHr.map((s) => s.bpm));
    const baselineAvgBpm = mean(referenceHr.map((s) => s.bpm));
    signal.restingHr = {
      avgBpm: round(avgBpm, 1),
      baselineAvgBpm: round(baselineAvgBpm, 1),
      deltaBpm: round(avgBpm - baselineAvgBpm, 1),
      score: round(interpolate(RESTING_HR_DELTA_CURVE, avgBpm - baselineAvgBpm)),
    };
  }

  const parts: { score: number; weight: number }[] = [];
  if (signal.sleep) parts.push({ score: signal.sleep.score, weight: RECOVERY_WEIGHTS.sleep });
  if (signal.restingHr) parts.push({ score: signal.restingHr.score, weight: RECOVERY_WEIGHTS.restingHr });

  if (parts.length === 0) {
    signal.unavailableReason =
      'Sin sueño ni FC en reposo de esta semana en Apple Health (la FC en reposo además necesita 4 semanas previas de referencia). Abre Google Health para sincronizar el Fitbit.';
    return signal;
  }
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  signal.available = true;
  signal.score = round(parts.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight);
  return signal;
}

// ── Intensidad (días funcionales) ────────────────────────────────────────────

/**
 * Cruza cada sesión funcional con su entrenamiento de Apple Health: primero por solapamiento
 * de horario y, si no hay, con el entrenamiento más largo de ese día.
 */
function matchWorkout(session: Session, workouts: readonly WorkoutSummary[]): WorkoutSummary | null {
  const start = Date.parse(session.startedAt);
  const end = session.finishedAt ? Date.parse(session.finishedAt) : start + ASSUMED_SESSION_MINUTES * 60_000;

  let best: WorkoutSummary | null = null;
  let bestOverlap = 0;
  for (const workout of workouts) {
    const overlap = Math.min(end, workout.end.getTime()) - Math.max(start, workout.start.getTime());
    if (overlap > bestOverlap) {
      best = workout;
      bestOverlap = overlap;
    }
  }
  if (best) return best;

  const sameDay = workouts.filter((workout) => toDateKey(workout.start) === session.date);
  return sameDay.sort((a, b) => b.durationMinutes - a.durationMinutes)[0] ?? null;
}

/**
 * Evalúa las sesiones FUNCIONALES por su FC media (como fracción de tu FC máxima) y su ritmo
 * de calorías (vs. tu mediana en sesiones funcionales de las 4 semanas previas).
 */
function computeIntensity(
  sessions: readonly Session[],
  health: HealthWeekData | null,
  w: Windows,
  baseWeight: number,
): IntensitySignal {
  const signal: IntensitySignal = {
    ...emptyBase('intensity', baseWeight),
    id: 'intensity',
    maxHrBpm: DEFAULT_MAX_HR,
    maxHrSource: 'estimada',
    sessions: [],
    sessionsWithoutData: 0,
  };

  const functional = sessions.filter(
    (s) => s.dayType === 'funcional' && hasSets(s) && s.date >= w.weekStartKey && s.date <= w.weekEndKey,
  );
  if (functional.length === 0) {
    signal.unavailableReason = 'No hubo sesiones funcionales esta semana.';
    return signal;
  }
  if (!health) {
    signal.unavailableReason = NO_HEALTH;
    return signal;
  }

  // FC máxima: la más alta que hayas alcanzado en entrenamientos recientes, si hay suficientes.
  const lookbackStart = addDays(w.now, -MAX_HR_LOOKBACK_DAYS);
  const observed = health.workouts
    .filter((x) => x.start >= lookbackStart && x.maxHeartRateBpm !== null)
    .map((x) => x.maxHeartRateBpm as number);
  if (observed.length >= MIN_WORKOUTS_FOR_MAX_HR) {
    signal.maxHrBpm = Math.round(Math.max(...observed));
    signal.maxHrSource = 'observada';
  }

  // Referencia de calorías por minuto: tus sesiones funcionales previas.
  const kcalPerMin = (x: WorkoutSummary) =>
    x.activeEnergyKcal !== null && x.durationMinutes > 0 ? x.activeEnergyKcal / x.durationMinutes : null;
  const baselineRates = sessions
    .filter((s) => s.dayType === 'funcional' && hasSets(s) && s.date >= w.refStartKey && s.date < w.weekStartKey)
    .map((s) => matchWorkout(s, health.workouts))
    .map((x) => (x ? kcalPerMin(x) : null))
    .filter((rate): rate is number => rate !== null);
  const baselineRate = baselineRates.length >= MIN_BASELINE_ENERGY_SESSIONS ? median(baselineRates) : null;

  for (const session of functional) {
    const workout = matchWorkout(session, health.workouts);
    if (!workout || workout.avgHeartRateBpm === null) {
      signal.sessionsWithoutData += 1;
      continue;
    }
    const hrFraction = workout.avgHeartRateBpm / signal.maxHrBpm;
    const rate = kcalPerMin(workout);
    const energyRatio = rate !== null && baselineRate ? rate / baselineRate : null;

    const hrScore = interpolate(HR_FRACTION_CURVE, hrFraction);
    const score =
      energyRatio === null
        ? hrScore
        : INTENSITY_WEIGHTS.hr * hrScore + INTENSITY_WEIGHTS.energy * interpolate(ENERGY_RATIO_CURVE, energyRatio);

    const result: IntensitySession = {
      sessionId: session.id,
      date: session.date,
      activityType: workout.activityType,
      durationMinutes: workout.durationMinutes,
      avgHrBpm: round(workout.avgHeartRateBpm),
      maxHrBpm: workout.maxHeartRateBpm === null ? null : round(workout.maxHeartRateBpm),
      hrFraction: round(hrFraction, 2),
      kcal: workout.activeEnergyKcal === null ? null : round(workout.activeEnergyKcal),
      kcalPerMin: rate === null ? null : round(rate, 1),
      energyRatio: energyRatio === null ? null : round(energyRatio, 2),
      score: round(score),
    };
    signal.sessions.push(result);
  }

  if (signal.sessions.length === 0) {
    signal.unavailableReason =
      'Ninguna sesión funcional coincide con un entrenamiento con FC en Apple Health. Confirma que el Fitbit registró el entrenamiento y sincroniza Google Health.';
    return signal;
  }
  signal.available = true;
  signal.score = round(mean(signal.sessions.map((s) => s.score)));
  return signal;
}

// ── Peso corporal ────────────────────────────────────────────────────────────

/** Tendencia de peso de las últimas 4 semanas (regresión lineal), en % de peso por semana. */
function computeBodyWeight(
  entries: ScoreInput['bodyWeights'],
  w: Windows,
  baseWeight: number,
): BodyWeightSignal {
  const signal: BodyWeightSignal = {
    ...emptyBase('bodyWeight', baseWeight),
    id: 'bodyWeight',
    latestKg: null,
    entries: 0,
    changeKg: null,
    pctPerWeek: null,
  };

  const endKey = toDateKey(w.windowEnd);
  const windowStartKey = toDateKey(addDays(w.windowEnd, -(BODY_WEIGHT_WINDOW_DAYS - 1)));
  const upToEnd = entries.filter((e) => e.date <= endKey);
  signal.latestKg = upToEnd.length > 0 ? upToEnd[upToEnd.length - 1].weightKg : null;

  const inWindow = upToEnd.filter((e) => e.date >= windowStartKey);
  signal.entries = inWindow.length;
  const span = inWindow.length > 0 ? daysBetweenKeys(inWindow[0].date, inWindow[inWindow.length - 1].date) : 0;

  if (inWindow.length < MIN_BODY_WEIGHT_ENTRIES || span < MIN_BODY_WEIGHT_SPAN_DAYS) {
    signal.unavailableReason = `Registra tu peso al menos ${MIN_BODY_WEIGHT_ENTRIES} veces en ${MIN_BODY_WEIGHT_SPAN_DAYS}+ días para ver la tendencia (hay ${inWindow.length}).`;
    return signal;
  }

  const origin = parseDateKey(inWindow[0].date).getTime();
  const points = inWindow.map(
    (e) => [Math.round((parseDateKey(e.date).getTime() - origin) / 86_400_000), e.weightKg] as const,
  );
  const slopePerDay = linearSlope(points);
  const pctPerWeek = ((slopePerDay * 7) / mean(inWindow.map((e) => e.weightKg))) * 100;

  signal.available = true;
  signal.pctPerWeek = round(pctPerWeek, 2);
  signal.changeKg = round(slopePerDay * span, 1);
  signal.score = round(interpolate(BODY_WEIGHT_CURVE, pctPerWeek));
  return signal;
}

// ── Score final ──────────────────────────────────────────────────────────────

export function computeFitScore(input: ScoreInput): FitScore {
  const { weekStart, now, sessions, bodyWeights, health } = input;
  const weekEnd = endOfWeek(weekStart);
  const refStart = addDays(weekStart, -BASELINE_DAYS);
  const w: Windows = {
    weekStart,
    windowEnd: now < weekEnd ? now : weekEnd,
    weekStartKey: toDateKey(weekStart),
    weekEndKey: toDateKey(weekEnd),
    refStart,
    refStartKey: toDateKey(refStart),
    now,
  };

  const weekSessions = sessions.filter(
    (s) => hasSets(s) && s.date >= w.weekStartKey && s.date <= w.weekEndKey,
  );
  const fuerza = weekSessions.filter((s) => s.dayType === 'fuerza').length;
  const funcional = weekSessions.length - fuerza;
  // Sin sesiones no hay mezcla que calcular: se usa 50/50 solo para mostrar los pesos.
  const fuerzaShare = weekSessions.length > 0 ? fuerza / weekSessions.length : 0.5;

  const blended = (id: SignalId) =>
    fuerzaShare * DAY_TYPE_WEIGHTS.fuerza[id] + (1 - fuerzaShare) * DAY_TYPE_WEIGHTS.funcional[id];

  const progression = computeProgression(sessions, w, blended('progression'));
  const recovery = computeRecovery(health, w, blended('recovery'));
  const intensity = computeIntensity(sessions, health, w, blended('intensity'));
  const bodyWeight = computeBodyWeight(bodyWeights, w, blended('bodyWeight'));
  const signals: SignalBase[] = [progression, recovery, intensity, bodyWeight];

  // Redistribuye el peso de las señales sin datos entre las disponibles.
  const coverage = signals.filter((s) => s.available).reduce((sum, s) => sum + s.baseWeight, 0);
  for (const s of signals) s.weight = s.available && coverage > 0 ? round(s.baseWeight / coverage, 4) : 0;

  const availableCount = signals.filter((s) => s.available).length;
  let score: number | null = null;
  let missingReason: string | null = null;

  if (weekSessions.length === 0) {
    missingReason = 'No hay sesiones con sets registrados en esta semana.';
  } else if (availableCount < MIN_SIGNALS) {
    missingReason = `Solo hay ${availableCount} de 4 señales con datos; se necesitan al menos ${MIN_SIGNALS} para calcular el score.`;
  } else {
    score = round(signals.reduce((sum, s) => sum + (s.available ? (s.score as number) * s.weight : 0), 0));
  }

  return {
    weekStart: w.weekStartKey,
    weekEnd: w.weekEndKey,
    isPartial: now < weekEnd,
    sessions: { fuerza, funcional },
    fuerzaShare: round(fuerzaShare, 3),
    score,
    label: score === null ? null : SCORE_BANDS.find((band) => score >= band.min)!.label,
    coverage: round(coverage, 3),
    missingReason,
    progression,
    recovery,
    intensity,
    bodyWeight,
  };
}
