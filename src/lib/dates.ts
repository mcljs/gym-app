import type { Weekday } from '@/types';

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Día de la semana ISO (1 = lunes … 7 = domingo). `Date#getDay` usa 0 = domingo. */
export function getIsoWeekday(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

/** Fecha LOCAL como 'YYYY-MM-DD' (no UTC: entrenar de noche no debe caer en "mañana"). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Copia de `date` desplazada `days` días (usa el calendario local, así respeta cambios de horario). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Lunes 00:00 (hora local) de la semana ISO que contiene `date`. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return addDays(start, -(getIsoWeekday(start) - 1));
}

/** Último instante (domingo 23:59:59.999) de la semana que empieza en `weekStart`. */
export function endOfWeek(weekStart: Date): Date {
  return new Date(addDays(weekStart, 7).getTime() - 1);
}

/** Interpreta 'YYYY-MM-DD' como fecha local a las 00:00. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Días completos entre dos fechas 'YYYY-MM-DD' (b - a). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / 86_400_000);
}

/** Hora local 'HH:MM' a partir de un ISO. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Ej.: "Hoy 14:32", "Ayer 23:10" o "17/09 07:00". */
export function formatDateTime(date: Date, now = new Date()): string {
  const time = formatTime(date.toISOString());
  const dayKey = toDateKey(date);
  if (dayKey === toDateKey(now)) return `Hoy ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey === toDateKey(yesterday)) return `Ayer ${time}`;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')} ${time}`;
}

/** Ej.: 432 → "7 h 12 min"; 45 → "45 min". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

/** Ej.: '2026-09-17' → "17 sep". */
export function formatShortDate(key: string): string {
  const date = parseDateKey(key);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`;
}

/** Ej.: "14 – 20 sep" o "28 sep – 4 oct" para la semana que empieza en `weekStart`. */
export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const short = (d: Date) => MONTH_NAMES[d.getMonth()].slice(0, 3);
  return weekStart.getMonth() === end.getMonth()
    ? `${weekStart.getDate()} – ${end.getDate()} ${short(end)}`
    : `${weekStart.getDate()} ${short(weekStart)} – ${end.getDate()} ${short(end)}`;
}

/** Ej.: "19 de septiembre". */
export function formatLongDate(date: Date): string {
  return `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`;
}
