import type { RepTarget } from '@/types';

/** Ej.: "4×7-9" o "3×12" cuando el rango es un solo valor. */
export function formatTarget({ sets, repsMin, repsMax }: RepTarget): string {
  const reps = repsMin === repsMax ? `${repsMin}` : `${repsMin}-${repsMax}`;
  return `${sets}×${reps}`;
}
