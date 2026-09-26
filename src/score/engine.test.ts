/**
 * Pruebas del motor del Fit Score con datos fabricados.
 * Correr:  npx --yes tsx --test src/score/engine.test.ts
 * (usa el test runner integrado de Node; no agrega dependencias al proyecto)
 */
/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { HealthWeekData, HeartRateSample, SleepNight, WorkoutSummary } from '@/health/types';
import { toDateKey } from '@/lib/dates';
import type { BodyWeightEntry, ExerciseKind, LoggedSet, Session } from '@/types';

import { computeFitScore } from './engine';

// Semana evaluada: lunes 14 → domingo 20 de septiembre de 2026 (hora local).
const WEEK_START = new Date(2026, 8, 14);
const NOW = new Date(2026, 8, 20, 12, 0); // domingo al mediodía: semana casi completa
const d = (day: number, hour = 10, minute = 0) => new Date(2026, 8, day, hour, minute);

let counter = 0;
const id = () => `id${++counter}`;

const set = (weightKg: number, reps: number, isAmrap = false): LoggedSet => ({ id: id(), weightKg, reps, isAmrap });

function session(day: number, dayType: ExerciseKind, exercises: Record<string, LoggedSet[]>, month = 8): Session {
  const start = new Date(2026, month, day, 18, 0);
  return {
    id: id(),
    date: toDateKey(start),
    weekday: 1,
    dayType,
    startedAt: start.toISOString(),
    finishedAt: new Date(start.getTime() + 60 * 60_000).toISOString(),
    exercises: Object.entries(exercises).map(([slug, sets]) => ({ id: id(), exerciseSlug: slug, target: null, sets })),
  };
}

const score = (overrides: Partial<Parameters<typeof computeFitScore>[0]> = {}) =>
  computeFitScore({ weekStart: WEEK_START, now: NOW, sessions: [], bodyWeights: [], health: null, ...overrides });

// ── Datos de salud fabricados ────────────────────────────────────────────────

const night = (endDay: number, minutesAsleep: number): SleepNight =>
  ({ start: d(endDay - 1, 23), end: d(endDay, 7), minutesAsleep }) as unknown as SleepNight;

const restingHr = (day: number, bpm: number, month = 8): HeartRateSample => ({
  bpm,
  start: new Date(2026, month, day, 8),
  end: new Date(2026, month, day, 8),
  source: 'Fitbit',
  device: null,
});

function workout(day: number, avgHr: number | null, maxHr: number | null, kcal: number | null, minutes = 60, month = 8): WorkoutSummary {
  const start = new Date(2026, month, day, 18, 0);
  return {
    id: id(),
    activityType: 'functionalStrengthTraining',
    start,
    end: new Date(start.getTime() + minutes * 60_000),
    durationMinutes: minutes,
    activeEnergyKcal: kcal,
    distanceMeters: null,
    avgHeartRateBpm: avgHr,
    maxHeartRateBpm: maxHr,
    source: 'Fitbit',
    device: null,
  };
}

const health = (partial: Partial<HealthWeekData>): HealthWeekData => ({ nights: [], restingHr: [], workouts: [], ...partial });

// ── Progresión de carga ──────────────────────────────────────────────────────

describe('progresión de carga', () => {
  it('sube la carga → "progreso" con puntaje 100', () => {
    const r = score({
      sessions: [
        session(3, 'fuerza', { 'bench-press': [set(80, 8)] }), // semana previa
        session(15, 'fuerza', { 'bench-press': [set(82.5, 8)] }),
      ],
    });
    const ex = r.progression.exercises[0];
    assert.equal(ex.status, 'progreso');
    assert.equal(ex.deltaPct, 3.1);
    assert.equal(ex.score, 100);
    assert.equal(r.progression.score, 100);
  });

  it('misma carga → "mantuvo" (80) y −10 % → "retroceso" (20)', () => {
    const same = score({
      sessions: [session(3, 'fuerza', { squat: [set(100, 5)] }), session(15, 'fuerza', { squat: [set(100, 5)] })],
    });
    assert.equal(same.progression.exercises[0].status, 'mantuvo');
    assert.equal(same.progression.score, 80);

    const worse = score({
      sessions: [session(3, 'fuerza', { squat: [set(100, 5)] }), session(15, 'fuerza', { squat: [set(90, 5)] })],
    });
    assert.equal(worse.progression.exercises[0].status, 'retroceso');
    assert.equal(worse.progression.score, 20);
  });

  it('AMRAP contra AMRAP: ignora un set normal más pesado', () => {
    const r = score({
      sessions: [
        session(3, 'fuerza', { squat: [set(60, 10, true)] }),
        session(15, 'fuerza', { squat: [set(70, 5), set(60, 12, true)] }), // AMRAP subió 2 reps
      ],
    });
    const ex = r.progression.exercises[0];
    assert.equal(ex.basis, 'amrap');
    assert.deepEqual(ex.current, { weightKg: 60, reps: 12 });
    assert.deepEqual(ex.reference, { weightKg: 60, reps: 10 });
    assert.equal(ex.deltaPct, 5); // 1RM estimado 84 vs 80
  });

  it('sin AMRAP en ambos períodos usa todos los sets', () => {
    const r = score({
      sessions: [session(3, 'fuerza', { squat: [set(60, 10)] }), session(15, 'fuerza', { squat: [set(60, 12, true)] })],
    });
    assert.equal(r.progression.exercises[0].basis, 'todos');
  });

  it('peso corporal (0 kg): compara repeticiones', () => {
    const r = score({
      sessions: [session(3, 'fuerza', { 'pull-up': [set(0, 8)] }), session(15, 'fuerza', { 'pull-up': [set(0, 10)] })],
    });
    assert.equal(r.progression.exercises[0].deltaPct, 25);
  });

  it('un ejercicio sin referencia es "nuevo" y no puntúa', () => {
    const r = score({ sessions: [session(15, 'fuerza', { 'bench-press': [set(80, 8)] })] });
    assert.equal(r.progression.available, false);
    assert.deepEqual(r.progression.newExercises, ['bench-press']);
  });

  it('ignora las sesiones funcionales y las de más de 4 semanas atrás', () => {
    const r = score({
      sessions: [
        session(3, 'funcional', { squat: [set(20, 10)] }),
        session(1, 'fuerza', { squat: [set(100, 5)] }, 6), // julio: fuera de la ventana de 28 días
        session(15, 'fuerza', { squat: [set(100, 5)] }),
      ],
    });
    assert.equal(r.progression.available, false);
  });
});

// ── Pesos por tipo de día y redistribución ───────────────────────────────────

describe('pesos por tipo de día', () => {
  it('mezcla las filas según la proporción de sesiones (2 fuerza + 1 funcional)', () => {
    const r = score({
      sessions: [
        session(15, 'fuerza', { squat: [set(100, 5)] }),
        session(16, 'fuerza', { squat: [set(100, 5)] }),
        session(18, 'funcional', { squat: [set(20, 10)] }),
      ],
    });
    assert.equal(r.fuerzaShare, 0.667);
    assert.deepEqual(r.sessions, { fuerza: 2, funcional: 1 });
    // progresión: 2/3 × 0.55 + 1/3 × 0.10 = 0.40
    assert.ok(Math.abs(r.progression.baseWeight - 0.4) < 1e-9);
    // intensidad: 2/3 × 0 + 1/3 × 0.45 = 0.15
    assert.ok(Math.abs(r.intensity.baseWeight - 0.15) < 1e-9);
    const total = r.progression.baseWeight + r.recovery.baseWeight + r.intensity.baseWeight + r.bodyWeight.baseWeight;
    assert.ok(Math.abs(total - 1) < 1e-9);
  });

  it('una semana solo de fuerza da peso 0 a la intensidad; solo funcional pesa la intensidad al 45 %', () => {
    const fuerza = score({ sessions: [session(15, 'fuerza', { squat: [set(100, 5)] })] });
    assert.equal(fuerza.intensity.baseWeight, 0);
    assert.equal(fuerza.progression.baseWeight, 0.55);

    const funcional = score({ sessions: [session(15, 'funcional', { squat: [set(20, 10)] })] });
    assert.equal(funcional.intensity.baseWeight, 0.45);
    assert.equal(funcional.progression.baseWeight, 0.1);
  });

  it('redistribuye el peso de las señales sin datos (suma 1) y calcula cobertura', () => {
    const bodyWeights: BodyWeightEntry[] = [
      { id: id(), date: '2026-08-25', weightKg: 80 },
      { id: id(), date: '2026-09-05', weightKg: 80.3 },
      { id: id(), date: '2026-09-18', weightKg: 80.7 },
    ];
    const r = score({
      sessions: [session(3, 'fuerza', { squat: [set(100, 5)] }), session(15, 'fuerza', { squat: [set(105, 5)] })],
      bodyWeights,
    });
    assert.equal(r.recovery.available, false);
    assert.equal(r.recovery.weight, 0);
    assert.ok(Math.abs(r.progression.weight + r.bodyWeight.weight - 1) < 1e-3);
    // cobertura = 0.55 (progresión) + 0.20 (peso) = 0.75
    assert.equal(r.coverage, 0.75);
    assert.ok(r.score !== null);
  });

  it('con menos de 2 señales no hay score y explica por qué', () => {
    const r = score({
      sessions: [session(3, 'fuerza', { squat: [set(100, 5)] }), session(15, 'fuerza', { squat: [set(105, 5)] })],
    });
    assert.equal(r.score, null);
    assert.equal(r.label, null);
    assert.match(r.missingReason!, /1 de 4 señales/);
  });

  it('sin sesiones esa semana: sin score', () => {
    const r = score();
    assert.equal(r.score, null);
    assert.match(r.missingReason!, /No hay sesiones/);
  });

  it('una sesión sin sets no cuenta', () => {
    const r = score({ sessions: [session(15, 'fuerza', { squat: [] })] });
    assert.deepEqual(r.sessions, { fuerza: 0, funcional: 0 });
  });
});

// ── Recuperación ─────────────────────────────────────────────────────────────

describe('recuperación', () => {
  const baselineSleep = [1, 3, 5, 7, 8].map((day) => night(day, 450)); // noches de la referencia (septiembre 1–8)
  const baselineHr = [1, 2, 3, 4, 5, 6].map((day) => restingHr(day, 55));

  it('combina sueño (7 h → 80) y FC en reposo (+3 bpm → 50) con pesos 55/45', () => {
    const r = score({
      health: health({
        nights: [...baselineSleep, night(15, 420), night(16, 420), night(17, 420)],
        restingHr: [restingHr(15, 58), restingHr(16, 58), ...baselineHr],
      }),
    });
    assert.equal(r.recovery.sleep!.score, 80);
    assert.equal(r.recovery.sleep!.deltaMinutes, -30);
    assert.equal(r.recovery.restingHr!.deltaBpm, 3);
    assert.equal(r.recovery.restingHr!.score, 50);
    assert.equal(r.recovery.score, 67); // 0.55×80 + 0.45×50 = 66.5
  });

  it('FC en reposo sin referencia previa: puntúa solo el sueño', () => {
    const r = score({ health: health({ nights: [night(15, 450), night(16, 450)], restingHr: [restingHr(15, 58)] }) });
    assert.equal(r.recovery.restingHr, null);
    assert.equal(r.recovery.score, 100);
  });

  it('sin datos de salud: no disponible y pide conectar Apple Health', () => {
    const r = score({ health: null });
    assert.equal(r.recovery.available, false);
    assert.match(r.recovery.unavailableReason!, /Apple Health/);
  });

  it('las noches de fuera de la semana no cuentan como esta semana', () => {
    const r = score({ health: health({ nights: [night(8, 300)] }) });
    assert.equal(r.recovery.sleep, null);
  });
});

// ── Intensidad ───────────────────────────────────────────────────────────────

describe('intensidad (días funcionales)', () => {
  const funcional = session(18, 'funcional', { 'goblet-squat': [set(20, 10)] });
  // 3 entrenamientos previos con FC máx. 180 → FC máx. "observada".
  const history = [workout(1, 150, 180, 400, 60, 8), workout(3, 150, 178, 400, 60, 8), workout(5, 150, 175, 400, 60, 8)];

  it('FC media 150 con FCmáx observada 180 (83 %) → puntaje 100', () => {
    const r = score({ sessions: [funcional], health: health({ workouts: [workout(18, 150, 176, 420), ...history] }) });
    assert.equal(r.intensity.maxHrSource, 'observada');
    assert.equal(r.intensity.maxHrBpm, 180);
    assert.equal(r.intensity.sessions[0].hrFraction, 0.83);
    assert.equal(r.intensity.score, 100);
  });

  it('con poco historial usa la FCmáx estimada (190) y lo indica', () => {
    const r = score({ sessions: [funcional], health: health({ workouts: [workout(18, 133, 160, 300)] }) });
    assert.equal(r.intensity.maxHrSource, 'estimada');
    assert.equal(r.intensity.maxHrBpm, 190);
    assert.equal(r.intensity.sessions[0].hrFraction, 0.7);
    assert.equal(r.intensity.score, 70);
  });

  it('ritmo de calorías vs. tu mediana previa afecta al puntaje (70 % FC + 30 % calorías)', () => {
    const previousFunctional = [session(1, 'funcional', { squat: [set(20, 10)] }, 8), session(3, 'funcional', { squat: [set(20, 10)] }, 8)];
    const r = score({
      sessions: [funcional, ...previousFunctional],
      // referencia: 400 kcal/60 min = 6.67/min; esta sesión 300/60 = 5/min → ratio 0.75
      health: health({ workouts: [workout(18, 150, 176, 300), ...history] }),
    });
    const s = r.intensity.sessions[0];
    assert.equal(s.energyRatio, 0.75);
    // 0.7 × 100 (FC) + 0.3 × interp(0.75 → 62.5) = 88.75
    assert.equal(s.score, 89);
  });

  it('sesión funcional sin entrenamiento en Apple Health: cuenta como sin datos', () => {
    const r = score({ sessions: [funcional], health: health({ workouts: [] }) });
    assert.equal(r.intensity.available, false);
    assert.equal(r.intensity.sessionsWithoutData, 1);
  });

  it('cruza por solapamiento de horario, no solo por día', () => {
    const morning = workout(18, 100, 120, 100, 30);
    morning.start = d(18, 7);
    morning.end = d(18, 7, 30);
    const r = score({ sessions: [funcional], health: health({ workouts: [morning, workout(18, 150, 176, 420)] }) });
    assert.equal(r.intensity.sessions[0].avgHrBpm, 150); // eligió el de la tarde (18:00), no el de la mañana
  });

  it('una semana sin sesiones funcionales: no disponible', () => {
    const r = score({ sessions: [session(15, 'fuerza', { squat: [set(100, 5)] })], health: health({}) });
    assert.equal(r.intensity.available, false);
  });
});

// ── Peso corporal ────────────────────────────────────────────────────────────

describe('tendencia de peso corporal', () => {
  const entry = (date: string, weightKg: number): BodyWeightEntry => ({ id: id(), date, weightKg });

  it('subir ~0.3 %/semana (meta: hipertrofia) → 100', () => {
    const r = score({
      bodyWeights: [entry('2026-08-24', 80), entry('2026-09-01', 80.3), entry('2026-09-10', 80.6), entry('2026-09-19', 80.9)],
    });
    assert.equal(r.bodyWeight.available, true);
    assert.ok(r.bodyWeight.pctPerWeek! > 0.1 && r.bodyWeight.pctPerWeek! < 0.5);
    assert.equal(r.bodyWeight.score, 100);
  });

  it('bajar de peso puntúa bajo y estancarse puntúa medio', () => {
    const losing = score({ bodyWeights: [entry('2026-08-24', 82), entry('2026-09-05', 81), entry('2026-09-19', 79.5)] });
    assert.ok(losing.bodyWeight.score! < 30);
    const flat = score({ bodyWeights: [entry('2026-08-24', 80), entry('2026-09-05', 80), entry('2026-09-19', 80)] });
    assert.equal(flat.bodyWeight.score, 65);
  });

  it('pocos registros o muy juntos: no disponible', () => {
    const few = score({ bodyWeights: [entry('2026-09-18', 80), entry('2026-09-19', 80.2)] });
    assert.equal(few.bodyWeight.available, false);
    assert.equal(few.bodyWeight.latestKg, 80.2);
    const close = score({ bodyWeights: [entry('2026-09-14', 80), entry('2026-09-16', 80), entry('2026-09-19', 80)] });
    assert.equal(close.bodyWeight.available, false);
  });
});

// ── Semanas ──────────────────────────────────────────────────────────────────

describe('semanas', () => {
  it('marca la semana en curso como provisional y una pasada como definitiva', () => {
    assert.equal(score({ now: d(17) }).isPartial, true);
    assert.equal(score({ now: new Date(2026, 8, 25) }).isPartial, false);
  });

  it('evalúa la semana pedida, no la actual', () => {
    const r = computeFitScore({
      weekStart: new Date(2026, 8, 7),
      now: NOW,
      sessions: [session(9, 'fuerza', { squat: [set(100, 5)] })],
      bodyWeights: [],
      health: null,
    });
    assert.deepEqual(r.sessions, { fuerza: 1, funcional: 0 });
    assert.equal(r.weekStart, '2026-09-07');
    assert.equal(r.weekEnd, '2026-09-13');
  });
});
