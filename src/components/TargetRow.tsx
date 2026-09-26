import { Pressable, Text, View } from "react-native";

import { ExerciseThumb } from "@/components/ExerciseThumb";
import { Stepper } from "@/components/Stepper";
import { getExercise, muscleLabel } from "@/data/catalog";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import type { ExerciseTarget, Weekday } from "@/types";

interface TargetRowProps {
  position: number;
  weekday: Weekday;
  target: ExerciseTarget;
  isFirst: boolean;
  isLast: boolean;
}

/** Ejercicio de la PLANTILLA de un día: reordenar, quitar y fijar series / rango de reps. */
export function TargetRow({
  weekday,
  target,
  position,
  isFirst,
  isLast,
}: TargetRowProps) {
  const updateTarget = useWorkoutStore((s) => s.updateTarget);
  const removeTarget = useWorkoutStore((s) => s.removeTarget);
  const moveTarget = useWorkoutStore((s) => s.moveTarget);

  const info = getExercise(target.exerciseSlug);

  return (
    <View className="gap-4 rounded-2xl border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between border-b border-line pb-3">
        <Text className="text-[10px] font-bold tracking-[2px] text-muted">
          EJERCICIO {String(position).padStart(2, "0")}
        </Text>
        <View className="flex-row items-center">
          <Pressable
            onPress={() => moveTarget(weekday, target.id, -1)}
            disabled={isFirst}
            accessibilityState={{ disabled: isFirst }}
            accessibilityLabel="Subir ejercicio"
            accessibilityRole="button"
            className={`h-11 w-11 items-center justify-center active:opacity-60 ${isFirst ? "opacity-25" : ""}`}
          >
            <Text className="text-lg text-muted">↑</Text>
          </Pressable>
          <Pressable
            onPress={() => moveTarget(weekday, target.id, 1)}
            disabled={isLast}
            accessibilityState={{ disabled: isLast }}
            accessibilityLabel="Bajar ejercicio"
            accessibilityRole="button"
            className={`h-11 w-11 items-center justify-center active:opacity-60 ${isLast ? "opacity-25" : ""}`}
          >
            <Text className="text-lg text-muted">↓</Text>
          </Pressable>
          <Pressable
            onPress={() => removeTarget(weekday, target.id)}
            accessibilityLabel="Quitar ejercicio de la plantilla"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center active:opacity-60"
          >
            <Text className="text-2xl text-danger">×</Text>
          </Pressable>
        </View>
      </View>
      <View className="flex-row items-center gap-3">
        <ExerciseThumb slug={target.exerciseSlug} size={56} />
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-ink" numberOfLines={2}>
            {info?.name ?? target.exerciseSlug}
          </Text>
          {info && (
            <Text className="text-xs text-muted">
              {muscleLabel(info.muscleGroup)}
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row flex-wrap items-start gap-2">
        <Stepper
          label="Series"
          value={target.sets}
          min={1}
          max={20}
          onChange={(sets) => updateTarget(weekday, target.id, { sets })}
        />
        <Stepper
          label="Reps mín"
          value={target.repsMin}
          onChange={(repsMin) => updateTarget(weekday, target.id, { repsMin })}
        />
        <Stepper
          label="Reps máx"
          value={target.repsMax}
          onChange={(repsMax) => updateTarget(weekday, target.id, { repsMax })}
        />
      </View>
    </View>
  );
}
