/**
 * Lógica pura para armar "la noche de sueño" a partir de segmentos crudos de HealthKit.
 * No toca módulos nativos, así que se puede probar sin iPhone.
 *
 * HealthKit entrega el sueño como muchos segmentos sueltos (uno por etapa), y si hay varias
 * fuentes (p. ej. el iPhone y el Fitbit vía Google Health) sus segmentos pueden SOLAPARSE.
 * Sumar todo duplicaría las horas, por eso los totales salen de una sola fuente: la que
 * registró más tiempo dormido.
 */
import type { SleepNight, SleepSegment, SleepStage } from './types';

/** Un hueco mayor a esto entre segmentos separa dos sesiones de sueño (noche vs. siesta). */
const SESSION_GAP_MS = 3 * 60 * 60 * 1000;

/** Una sesión con menos de esto (dormido o en cama) se considera siesta, no "la noche". */
const MIN_NIGHT_MINUTES = 3 * 60;

const ASLEEP_STAGES: readonly SleepStage[] = ['core', 'deep', 'rem', 'asleepUnspecified'];

const isAsleep = (stage: SleepStage) => ASLEEP_STAGES.includes(stage);

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

/** Agrupa segmentos (en cualquier orden) en sesiones de sueño, de la más antigua a la más reciente. */
export function groupSleepSessions(segments: readonly SleepSegment[]): SleepSegment[][] {
  const sorted = [...segments].sort((a, b) => a.start.getTime() - b.start.getTime());
  const sessions: SleepSegment[][] = [];
  let current: SleepSegment[] = [];
  let currentEnd = -Infinity;

  for (const segment of sorted) {
    if (current.length > 0 && segment.start.getTime() - currentEnd > SESSION_GAP_MS) {
      sessions.push(current);
      current = [];
      currentEnd = -Infinity;
    }
    current.push(segment);
    currentEnd = Math.max(currentEnd, segment.end.getTime());
  }
  if (current.length > 0) sessions.push(current);
  return sessions;
}

/** Convierte una sesión en una `SleepNight` usando solo la fuente principal. */
function buildNight(session: readonly SleepSegment[]): SleepNight {
  // Minutos dormidos y en cama por fuente, para elegir la principal.
  const perSource = new Map<string, { asleep: number; inBed: number }>();
  for (const segment of session) {
    const totals = perSource.get(segment.source) ?? { asleep: 0, inBed: 0 };
    const minutes = minutesBetween(segment.start, segment.end);
    if (isAsleep(segment.stage)) totals.asleep += minutes;
    if (segment.stage === 'inBed') totals.inBed += minutes;
    perSource.set(segment.source, totals);
  }
  const ranked = [...perSource.entries()].sort(
    ([, a], [, b]) => b.asleep - a.asleep || b.inBed - a.inBed,
  );
  const primarySource = ranked[0][0];
  const segments = session.filter((s) => s.source === primarySource);

  const minutesByStage = { core: 0, deep: 0, rem: 0, asleepUnspecified: 0 };
  let minutesAwake = 0;
  let minutesInBed = 0;
  for (const segment of segments) {
    const minutes = minutesBetween(segment.start, segment.end);
    if (segment.stage === 'awake') minutesAwake += minutes;
    else if (segment.stage === 'inBed') minutesInBed += minutes;
    else minutesByStage[segment.stage] += minutes;
  }

  const start = new Date(Math.min(...segments.map((s) => s.start.getTime())));
  const end = new Date(Math.max(...segments.map((s) => s.end.getTime())));

  return {
    start,
    end,
    minutesAsleep:
      minutesByStage.core + minutesByStage.deep + minutesByStage.rem + minutesByStage.asleepUnspecified,
    // Si la fuente principal no escribe "en cama" (p. ej. un Fitbit que solo da etapas), el
    // tiempo en cama se aproxima con el lapso total de la noche.
    minutesInBed: minutesInBed > 0 ? minutesInBed : minutesBetween(start, end),
    minutesAwake,
    minutesByStage,
    hasStages: minutesByStage.core + minutesByStage.deep + minutesByStage.rem > 0,
    primarySource,
    otherSources: ranked.slice(1).map(([source]) => source),
    segments,
  };
}

/** Todas las noches sustanciales (≥ 3 h; las siestas se descartan), de la más antigua a la más reciente. */
export function buildNights(segments: readonly SleepSegment[]): SleepNight[] {
  return groupSleepSessions(segments)
    .map(buildNight)
    .filter((night) => Math.max(night.minutesAsleep, night.minutesInBed) >= MIN_NIGHT_MINUTES);
}

/**
 * "Sueño de anoche": la sesión más reciente que sea sustancial (≥ 3 h), ignorando siestas.
 * Si ninguna llega a 3 h, devuelve la más larga. `null` si no hay segmentos.
 */
export function pickLastNight(segments: readonly SleepSegment[]): SleepNight | null {
  const nights = groupSleepSessions(segments).map(buildNight);
  if (nights.length === 0) return null;

  const length = (n: SleepNight) => Math.max(n.minutesAsleep, n.minutesInBed);
  const substantial = nights.filter((n) => length(n) >= MIN_NIGHT_MINUTES);
  if (substantial.length > 0) return substantial[substantial.length - 1];
  return nights.reduce((longest, n) => (length(n) > length(longest) ? n : longest));
}
