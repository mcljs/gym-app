import { EPLEY_MAX_REPS, type Curve } from './config';

/** Interpola linealmente sobre una curva de puntos; fuera de los extremos "recorta". */
export function interpolate(curve: Curve, x: number): number {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    if (x <= x1) {
      const [x0, y0] = curve[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

export function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Pendiente (unidades de y por unidad de x) de la recta de mínimos cuadrados. */
export function linearSlope(points: readonly (readonly [x: number, y: number])[]): number {
  const mx = mean(points.map(([x]) => x));
  const my = mean(points.map(([, y]) => y));
  let num = 0;
  let den = 0;
  for (const [x, y] of points) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export const round = (value: number, decimals = 0): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * 1RM estimado por Epley: peso × (1 + reps/30). Una sola repetición ES el máximo (no se
 * estima). Por encima de `EPLEY_MAX_REPS` la fórmula pierde fiabilidad y se recorta.
 * Lo usan el Fit Score y la vista de PRs, para que hablen del mismo número.
 */
export function epley1RM(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + Math.min(reps, EPLEY_MAX_REPS) / 30);
}
