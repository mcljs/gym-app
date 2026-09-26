import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

interface WeekNavigatorProps {
  /** Ej.: "14 – 20 sep". */
  label: string;
  /** `true` si se muestra la semana actual (no se puede avanzar más). */
  isCurrent: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** Contenido opcional a la derecha (p. ej. un botón de refrescar). */
  right?: ReactNode;
}

/** Selector de semana ‹ 14 – 20 sep ›: retrocede libremente, pero nunca más allá de la actual. */
export function WeekNavigator({
  label,
  isCurrent,
  onPrevious,
  onNext,
  right,
}: WeekNavigatorProps) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-1">
        <Pressable
          onPress={onPrevious}
          accessibilityRole="button"
          accessibilityLabel="Semana anterior"
          className="h-10 w-10 items-center justify-center rounded-lg bg-surface active:opacity-70"
        >
          <Text className="text-xl text-ink">‹</Text>
        </Pressable>
        <View className="min-w-[128px] items-center">
          <Text className="text-base font-bold text-ink">{label}</Text>
          <Text className="text-xs text-muted">
            {isCurrent ? "Esta semana" : "Semana anterior"}
          </Text>
        </View>
        <Pressable
          onPress={onNext}
          disabled={isCurrent}
          accessibilityRole="button"
          accessibilityState={{ disabled: isCurrent }}
          accessibilityLabel="Semana siguiente"
          className={`h-10 w-10 items-center justify-center rounded-lg bg-surface active:opacity-70 ${
            isCurrent ? "opacity-30" : ""
          }`}
        >
          <Text className="text-xl text-ink">›</Text>
        </Pressable>
      </View>
      {right}
    </View>
  );
}
