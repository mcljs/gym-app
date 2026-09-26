import { Pressable, Text, View } from 'react-native';

import { getExercise } from '@/data/catalog';
import type { Challenge } from '@/progress/types';

interface ChallengeCardProps {
  challenge: Challenge;
  /** Se llama al tocar la tarjeta (p. ej. para abrir el historial del ejercicio). */
  onPress?: () => void;
}

const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * "Reto del día". No caduca: se queda igual hasta que superes el número (o registres el
 * levantamiento, en el reto de línea base).
 */
export function ChallengeCard({ challenge, onPress }: ChallengeCardProps) {
  const name = getExercise(challenge.exerciseSlug)?.name ?? challenge.exerciseSlug;

  let title: string;
  let body: string;
  let target: string | null = null;

  if (challenge.kind === 'stale') {
    const { best, toBeat, weeksStale, liftKind } = challenge;
    title = `Reto: rompe tu meseta en ${name}`;
    body =
      liftKind === 'bodyweight'
        ? `Llevas ${weeksStale} semanas sin superar tus ${best.value} repeticiones.`
        : `Llevas ${weeksStale} semanas sin superar tu mejor marca: ${kg(best.value)} kg (${best.isTrue ? '1RM real' : '1RM estimado'}).`;
    target = liftKind === 'bodyweight' ? `Supera ${toBeat.reps} repeticiones` : `Supera ${kg(toBeat.weightKg)} kg × ${toBeat.reps}`;
  } else {
    title = `Reto: tu primera marca en ${name}`;
    body = 'Aún no lo tienes registrado. Haz una serie honesta y anótala: será tu línea base para medir el progreso.';
  }

  const isStale = challenge.kind === 'stale';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={`gap-1.5 rounded-2xl border p-4 active:opacity-80 ${
        isStale ? 'border-funcional/40 bg-funcional/10' : 'border-accent/40 bg-accent/10'
      }`}>
      <Text className={`text-base font-semibold ${isStale ? 'text-funcional' : 'text-accent'}`}>{title}</Text>
      <Text className="text-sm text-muted">{body}</Text>
      {target && (
        <View className="mt-1 self-start rounded-lg bg-elevated px-3 py-1.5">
          <Text className="text-sm font-bold text-ink">{target}</Text>
        </View>
      )}
      {onPress && isStale && <Text className="pt-1 text-xs text-muted">Ver historial ›</Text>}
    </Pressable>
  );
}
