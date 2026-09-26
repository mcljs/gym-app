/// <reference types="node" />
/**
 * Pruebas de PRs, estancados, retos y volumen con datos fabricados.
 * Correr:  npx --yes tsx --test src/progress/progress.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDays, toDateKey } from '@/lib/dates';
import { epley1RM } from '@/score/math';
import type { ExerciseKind, LoggedSet, Session } from '@/types';

import { pickChallenge } from './challenge';
import type { VolumeGroupId } from './config';
import { analyzeLifts } from './lifts';
import { weeklyVolume } from './volume';

// "Hoy" fijo: sábado 19 de septiembre de 2026.
const NOW = new Date(2026, 8, 19, 12, 0);
const daysAgo = (n: number) => addDays(NOW, -n);

let counter = 0;
const id = () => `id${++counter}`;
const set = (weightKg: number, reps: number): LoggedSet => ({ id: id(), weightKg, reps });

/** Sesión de hace `ago` días con los sets indicados por ejercicio. */
function session(ago: number, dayType: ExerciseKind, exercises: Record<string, LoggedSet[]>): Session {
  const date = daysAgo(ago);
  date.setHours(18, 0, 0, 0);
  return {
    id: id(),
    date: toDateKey(date),
    weekday: 1,
    dayType,
    startedAt: date.toISOString(),
    finishedAt: null,
    exercises: Object.entries(exercises).map(([slug, sets]) => ({ id: id(), exerciseSlug: slug, target: null, sets })),
  };
}

const lift = (sessions: Session[], slug: string) => analyzeLifts(sessions, NOW).find((l) => l.exerciseSlug === slug)!;

describe('1RM estimado (Epley)', () => {
  it('una sola repetición es el máximo, sin estimar', () => {
    assert.equal(epley1RM(120, 1), 120);
    assert.equal(epley1RM(100, 5), 100 * (1 + 5 / 30));
  });
});

describe('mejor marca, 1RM real vs. estimado', () => {
  it('distingue el máximo real (single) del estimado por Epley', () => {
    const l = lift(
      [
        session(30, 'fuerza', { squat: [set(100, 5)] }), // e1RM 116.7
        session(20, 'fuerza', { squat: [set(120, 1)] }), // 1RM real 120
      ],
      'squat',
    );
    assert.deepEqual(l.trueOneRm, { weightKg: 120, date: toDateKey(daysAgo(20)) });
    assert.equal(l.estimated!.e1rm, 116.7);
    assert.equal(l.best.value, 120);
    assert.equal(l.best.isTrue, true);
  });

  it('sin singles, la mejor marca es estimada y trueOneRm es null', () => {
    const l = lift([session(10, 'fuerza', { squat: [set(100, 5), set(90, 8)] })], 'squat');
    assert.equal(l.trueOneRm, null);
    assert.equal(l.best.isTrue, false);
    assert.equal(l.best.value, 116.7); // 90 × (1 + 8/30) = 114 < 100 × (1 + 5/30) = 116.7 → gana 116.7
  });

  it('un estimado mayor que el single real gana como mejor marca', () => {
    const l = lift([session(10, 'fuerza', { squat: [set(100, 1), set(100, 10)] })], 'squat'); // e1RM 133.3
    assert.equal(l.best.isTrue, false);
    assert.equal(l.best.value, 133.3);
    assert.equal(l.trueOneRm!.weightKg, 100);
  });

  it('marca la serie más pesada', () => {
    const l = lift([session(10, 'fuerza', { squat: [set(140, 2), set(100, 10)] })], 'squat');
    assert.deepEqual(l.heaviest, { weightKg: 140, reps: 2, date: toDateKey(daysAgo(10)) });
  });
});

describe('ejercicios estancados', () => {
  // Mejor marca hace 10 semanas; después se entrena igual o peor.
  const stalled = [
    session(90, 'fuerza', { 'bench-press': [set(80, 8)] }),
    session(70, 'fuerza', { 'bench-press': [set(85, 6)] }), // último PR: hace 10 semanas
    session(40, 'fuerza', { 'bench-press': [set(80, 8)] }),
    session(10, 'fuerza', { 'bench-press': [set(82.5, 6)] }),
  ];

  it('sin superar la marca en ≥ 8 semanas y aún entrenándolo → estancado', () => {
    const l = lift(stalled, 'bench-press');
    assert.equal(l.weeksSincePr, 10);
    assert.equal(l.lastPrDate, toDateKey(daysAgo(70)));
    assert.equal(l.stale, true);
  });

  it('un PR reciente lo saca del estancamiento', () => {
    const l = lift([...stalled, session(3, 'fuerza', { 'bench-press': [set(90, 6)] })], 'bench-press');
    assert.equal(l.stale, false);
    assert.equal(l.weeksSincePr, 0);
  });

  it('si lo abandonaste (sin entrenarlo en > 4 semanas) no cuenta como estancado', () => {
    const l = lift(stalled.slice(0, 3), 'bench-press');
    assert.equal(l.stale, false);
  });

  it('con menos de 3 sesiones no puede estancarse', () => {
    const l = lift([session(90, 'fuerza', { squat: [set(100, 5)] }), session(5, 'fuerza', { squat: [set(90, 5)] })], 'squat');
    assert.equal(l.stale, false);
  });

  it('exactamente 7 semanas sin PR todavía no es estancado', () => {
    const l = lift(
      [session(80, 'fuerza', { squat: [set(90, 5)] }), session(49, 'fuerza', { squat: [set(100, 5)] }), session(10, 'fuerza', { squat: [set(95, 5)] })],
      'squat',
    );
    assert.equal(l.weeksSincePr, 7);
    assert.equal(l.stale, false);
  });

  it('las sesiones funcionales no cuentan ni para PRs ni para estancamiento', () => {
    const lifts = analyzeLifts([session(5, 'funcional', { 'goblet-squat': [set(24, 12)] })], NOW);
    assert.equal(lifts.length, 0);
  });

  it('ordena: estancados primero (el más viejo antes), luego por recencia', () => {
    const sessions = [
      ...stalled, // bench estancado 10 sem
      session(100, 'fuerza', { squat: [set(100, 5)] }),
      session(60, 'fuerza', { squat: [set(105, 5)] }), // PR hace 8 semanas
      session(30, 'fuerza', { squat: [set(100, 5)] }),
      session(2, 'fuerza', { squat: [set(100, 5)] }),
      session(1, 'fuerza', { 'hammer-curl': [set(14, 10)] }),
    ];
    assert.deepEqual(analyzeLifts(sessions, NOW).map((l) => l.exerciseSlug), ['bench-press', 'squat', 'hammer-curl']);
  });

  it('propone una marca concreta que supera la mejor (+2.5 kg a las mismas reps)', () => {
    const l = lift(stalled, 'bench-press');
    assert.deepEqual(l.toBeat, { weightKg: 87.5, reps: 6 }); // mejor: 85 × 6
    assert.ok(epley1RM(l.toBeat.weightKg, l.toBeat.reps) > l.best.value);
  });
});

describe('PR de repeticiones', () => {
  it('más reps con el mismo peso que la mejor vez anterior', () => {
    const l = lift(
      [session(20, 'fuerza', { 'bench-press': [set(80, 8)] }), session(6, 'fuerza', { 'bench-press': [set(80, 10)] })],
      'bench-press',
    );
    assert.deepEqual(l.repPrs, [{ date: toDateKey(daysAgo(6)), weightKg: 80, reps: 10, previousBest: 8 }]);
  });

  it('las series de la propia sesión no se cuentan como PR entre sí', () => {
    const l = lift([session(6, 'fuerza', { 'bench-press': [set(80, 8), set(80, 10)] })], 'bench-press');
    assert.deepEqual(l.repPrs, []);
  });

  it('un peso nuevo no es PR de repeticiones (no hay contra qué comparar)', () => {
    const l = lift(
      [session(20, 'fuerza', { 'bench-press': [set(80, 8)] }), session(6, 'fuerza', { 'bench-press': [set(82.5, 12)] })],
      'bench-press',
    );
    assert.deepEqual(l.repPrs, []);
  });

  it('solo muestra los recientes (últimos 28 días)', () => {
    const l = lift(
      [
        session(90, 'fuerza', { squat: [set(100, 5)] }),
        session(80, 'fuerza', { squat: [set(100, 7)] }), // PR de reps, pero viejo
        session(5, 'fuerza', { squat: [set(100, 5)] }),
      ],
      'squat',
    );
    assert.deepEqual(l.repPrs, []);
  });
});

describe('peso corporal', () => {
  it('se mide por repeticiones y no tiene 1RM', () => {
    const l = lift(
      [session(20, 'fuerza', { 'pull-up': [set(0, 8)] }), session(6, 'fuerza', { 'pull-up': [set(0, 10)] })],
      'pull-up',
    );
    assert.equal(l.kind, 'bodyweight');
    assert.equal(l.best.value, 10);
    assert.equal(l.trueOneRm, null);
    assert.equal(l.estimated, null);
    assert.equal(l.heaviest, null);
    assert.deepEqual(l.toBeat, { weightKg: 0, reps: 11 });
  });
});

describe('historial por sesión', () => {
  it('marca qué sesiones fueron PR (la primera es línea base)', () => {
    const l = lift(
      [
        session(30, 'fuerza', { squat: [set(100, 5)] }),
        session(20, 'fuerza', { squat: [set(95, 5)] }),
        session(10, 'fuerza', { squat: [set(105, 5)] }),
      ],
      'squat',
    );
    assert.deepEqual(l.history.map((h) => h.isPr), [true, false, true]);
    assert.deepEqual(l.history.map((h) => h.topSet.weightKg), [100, 95, 105]);
  });
});

// ── Volumen ──────────────────────────────────────────────────────────────────

describe('volumen semanal', () => {
  const groupOf = (slug: string): VolumeGroupId | null =>
    ({ 'bench-press': 'chest', 'cable-fly': 'chest', 'hammer-curl': 'biceps', deadlift: 'posterior', plank: null })[slug] as VolumeGroupId | null ?? null;
  const WEEK_START = new Date(2026, 8, 14); // lunes 14
  const row = (rows: ReturnType<typeof weeklyVolume>, group: string) => rows.find((r) => r.group === group)!;

  it('cuenta series duras (≥ 5 reps) por grupo, solo de esa semana y solo de fuerza', () => {
    const rows = weeklyVolume(
      [
        session(4, 'fuerza', { 'bench-press': [set(80, 8), set(80, 8), set(80, 8), set(40, 3)] }), // 3 duras (el de 3 reps no cuenta)
        session(3, 'fuerza', { 'cable-fly': [set(15, 12), set(15, 12)] }), // +2 al pecho
        session(4, 'funcional', { 'bench-press': [set(30, 12)] }), // funcional: no cuenta
        session(10, 'fuerza', { 'bench-press': [set(80, 8)] }), // semana anterior: no cuenta
      ],
      WEEK_START,
      groupOf,
    );
    assert.equal(row(rows, 'chest').sets, 5);
  });

  it('estados: bajo (<10) con las series que faltan, en rango (10–20), alto (>20)', () => {
    const many = (n: number) => Array.from({ length: n }, () => set(80, 8));
    const at = (n: number) => weeklyVolume([session(4, 'fuerza', { 'bench-press': many(n) })], WEEK_START, groupOf);
    assert.deepEqual([row(at(6), 'chest').status, row(at(6), 'chest').missing], ['bajo', 4]);
    assert.equal(row(at(10), 'chest').status, 'en rango');
    assert.equal(row(at(20), 'chest').status, 'en rango');
    assert.equal(row(at(21), 'chest').status, 'alto');
    assert.equal(row(at(21), 'chest').missing, 0);
  });

  it('devuelve todos los grupos aunque tengan 0, y la cadena posterior no se evalúa', () => {
    const rows = weeklyVolume([session(4, 'fuerza', { deadlift: [set(140, 5), set(140, 5)] })], WEEK_START, groupOf);
    assert.equal(rows.length, 10);
    assert.equal(row(rows, 'back').sets, 0);
    assert.equal(row(rows, 'back').status, 'bajo');
    assert.equal(row(rows, 'posterior').sets, 2);
    assert.equal(row(rows, 'posterior').status, 'sin objetivo');
  });

  it('ejercicios sin grupo no suman a nada', () => {
    const rows = weeklyVolume([session(4, 'fuerza', { plank: [set(0, 30)] })], WEEK_START, groupOf);
    assert.equal(rows.reduce((sum, r) => sum + r.sets, 0), 0);
  });
});

// ── Retos ────────────────────────────────────────────────────────────────────

describe('reto del día', () => {
  const stalledBench = [
    session(90, 'fuerza', { 'bench-press': [set(80, 8)] }),
    session(70, 'fuerza', { 'bench-press': [set(85, 6)] }),
    session(40, 'fuerza', { 'bench-press': [set(80, 8)] }),
    session(10, 'fuerza', { 'bench-press': [set(82.5, 6)] }),
  ];

  it('prioriza el ejercicio más estancado, con el número a superar', () => {
    const challenge = pickChallenge(analyzeLifts(stalledBench, NOW));
    assert.equal(challenge?.kind, 'stale');
    if (challenge?.kind === 'stale') {
      assert.equal(challenge.exerciseSlug, 'bench-press');
      assert.equal(challenge.weeksStale, 10);
      assert.deepEqual(challenge.toBeat, { weightKg: 87.5, reps: 6 });
    }
  });

  it('sin estancados, propone registrar un levantamiento base que nunca hiciste', () => {
    const lifts = analyzeLifts(
      [
        session(5, 'fuerza', { squat: [set(100, 5)] }),
        session(4, 'fuerza', { 'bench-press': [set(80, 8)] }),
        session(3, 'fuerza', { deadlift: [set(140, 5)] }),
      ],
      NOW,
    );
    assert.deepEqual(pickChallenge(lifts), { kind: 'baseline', exerciseSlug: 'overhead-press' });
  });

  it('con poco historial (< 3 ejercicios) no propone levantamientos base', () => {
    assert.equal(pickChallenge(analyzeLifts([session(5, 'fuerza', { squat: [set(100, 5)] })], NOW)), null);
  });

  it('desaparece al superar la marca', () => {
    const beaten = [...stalledBench, session(2, 'fuerza', { 'bench-press': [set(87.5, 6)] })];
    const challenge = pickChallenge(analyzeLifts(beaten, NOW), ['bench-press']);
    assert.equal(challenge, null);
  });
});
