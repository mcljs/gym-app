import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ExerciseThumb } from '@/components/ExerciseThumb';
import { NumberField } from '@/components/NumberField';
import { getExercise, muscleLabel } from '@/data/catalog';
import { confirmDestructive } from '@/lib/confirm';
import { formatTarget } from '@/lib/format';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import type { LoggedExercise } from '@/types';

interface SessionExerciseCardProps {
  sessionId: string;
  exercise: LoggedExercise;
}

/**
 * Ejercicio de una sesión en curso: ilustración, objetivo y sets registrados.
 * Todo lo que se cambia aquí afecta SOLO a la sesión, nunca a la plantilla.
 */
export function SessionExerciseCard({ sessionId, exercise }: SessionExerciseCardProps) {
  const addSet = useWorkoutStore((s) => s.addSet);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const removeSessionExercise = useWorkoutStore((s) => s.removeSessionExercise);

  const info = getExercise(exercise.exerciseSlug);
  const { target, sets } = exercise;
  const done = sets.length;

  function handleRemoveExercise() {
    const remove = () => removeSessionExercise(sessionId, exercise.id);
    if (done === 0) return remove();
    confirmDestructive(
      'Quitar ejercicio',
      `Se borrarán los ${done} sets registrados de este ejercicio en la sesión de hoy. Tu plantilla no cambia.`,
      remove,
    );
  }

  return (
    <View className="gap-3 rounded-2xl border border-line bg-surface p-3">
      <View className="flex-row items-center gap-3">
        <ExerciseThumb slug={exercise.exerciseSlug} />
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-ink" numberOfLines={2}>
            {info?.name ?? exercise.exerciseSlug}
          </Text>
          {info && <Text className="text-xs text-muted">{muscleLabel(info.muscleGroup)}</Text>}
          <Text className="text-xs text-muted">
            {target ? `Objetivo ${formatTarget(target)}` : 'Agregado hoy · sin objetivo'}
            {target ? `  ·  ${done}/${target.sets} series` : `  ·  ${done} series`}
          </Text>
        </View>
        <Pressable
          onPress={handleRemoveExercise}
          accessibilityLabel="Quitar ejercicio de la sesión"
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-lg active:opacity-60">
          <Text className="text-2xl text-muted">×</Text>
        </Pressable>
      </View>

      {sets.length > 0 && (
        <View className="gap-2">
          <View className="flex-row items-center gap-2 px-1">
            <Text className="w-6 text-xs text-muted">Set</Text>
            <Text className="flex-1 text-center text-xs text-muted">Peso (kg)</Text>
            <Text className="flex-1 text-center text-xs text-muted">Reps</Text>
            <Text className="w-12 text-center text-xs text-muted">AMRAP</Text>
            <View className="w-9" />
          </View>
          {sets.map((set, index) => (
            <View key={set.id} className="flex-row items-center gap-2">
              <Text className="w-6 pl-1 text-sm font-semibold text-muted">{index + 1}</Text>
              <View className="flex-1">
                <NumberField
                  decimal
                  value={set.weightKg}
                  onChange={(weightKg) => updateSet(sessionId, exercise.id, set.id, { weightKg })}
                  accessibilityLabel={`Peso del set ${index + 1}`}
                />
              </View>
              <View className="flex-1">
                <NumberField
                  value={set.reps}
                  onChange={(reps) => updateSet(sessionId, exercise.id, set.id, { reps })}
                  accessibilityLabel={`Repeticiones del set ${index + 1}`}
                />
              </View>
              {/* AMRAP = reps al fallo. El Fit Score compara estos sets entre semanas. */}
              <Pressable
                onPress={() => updateSet(sessionId, exercise.id, set.id, { isAmrap: !set.isAmrap })}
                accessibilityRole="switch"
                accessibilityState={{ checked: !!set.isAmrap }}
                accessibilityLabel={`Set ${index + 1} al fallo (AMRAP)`}
                className={`h-11 w-12 items-center justify-center rounded-lg border active:opacity-70 ${
                  set.isAmrap ? 'border-accent bg-accent/15' : 'border-line bg-elevated'
                }`}>
                <Text className={`text-xs font-bold ${set.isAmrap ? 'text-accent' : 'text-muted'}`}>
                  {set.isAmrap ? 'SÍ' : '—'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => removeSet(sessionId, exercise.id, set.id)}
                accessibilityLabel={`Borrar set ${index + 1}`}
                hitSlop={6}
                className="h-9 w-9 items-center justify-center rounded-lg active:opacity-60">
                <Text className="text-2xl text-muted">×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Button label="+ Agregar set" variant="secondary" onPress={() => addSet(sessionId, exercise.id)} />
    </View>
  );
}
