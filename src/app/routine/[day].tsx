import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { DAY_TYPE_LABELS } from "@/components/DayTypeChip";
import { TargetRow } from "@/components/TargetRow";
import { WEEKDAYS, WEEKDAY_NAMES } from "@/lib/dates";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import type { DayType, Weekday } from "@/types";

const DAY_TYPES: DayType[] = ["fuerza", "funcional", "descanso"];

/** Editor de la plantilla, paso 2: un día concreto. Los cambios se guardan en el store al instante. */
export default function RoutineDayScreen() {
  const router = useRouter();
  const { day: dayParam } = useLocalSearchParams<{ day: string }>();
  const weekday = Number(dayParam) as Weekday;
  const isValid = WEEKDAYS.includes(weekday);

  // Con un parámetro inválido se lee el lunes solo para no romper el hook; la UI no se muestra.
  const day = useWorkoutStore((s) => s.template[isValid ? weekday : 1]);
  const setDayType = useWorkoutStore((s) => s.setDayType);

  if (!isValid) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-muted">Día no válido.</Text>
      </View>
    );
  }

  const isRest = day.dayType === "descanso";

  return (
    <ScrollView
      contentContainerClassName="pb-12"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: WEEKDAY_NAMES[weekday] }} />
      <View className="mx-auto w-full max-w-[760px] gap-6 p-5 md:p-8">
        <View className="gap-2">
          <Text className="text-[10px] font-bold tracking-[3px] text-accent">
            TU PLAN DE ENTRENAMIENTO
          </Text>
          <Text className="text-3xl font-bold tracking-tight text-ink">
            {isRest ? "Recuperar también suma." : "Prepara tu próxima sesión."}
          </Text>
          <Text className="text-sm leading-6 text-muted">
            {isRest
              ? "Dale espacio al descanso en tu semana."
              : `${day.targets.length} ejercicios · ${day.targets.reduce((n, t) => n + t.sets, 0)} series planeadas`}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-sm font-semibold uppercase tracking-wide text-muted">
            Tipo de día
          </Text>
          <View className="flex-row gap-1 rounded-2xl border border-line bg-surface p-1">
            {DAY_TYPES.map((type) => {
              const selected = day.dayType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setDayType(weekday, type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`flex-1 items-center rounded-xl py-3.5 active:opacity-70 ${
                    selected ? "bg-accent" : ""
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${selected ? "text-bg" : "text-muted"}`}
                  >
                    {DAY_TYPE_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {isRest ? (
          <View className="items-center gap-1 rounded-2xl border border-line bg-surface px-6 py-8">
            <Text className="text-base font-semibold text-ink">
              Día de descanso
            </Text>
            <Text className="text-center text-sm text-muted">
              {day.targets.length > 0
                ? `Los ${day.targets.length} ejercicios de este día se conservan si lo cambias de nuevo a fuerza o funcional.`
                : "Cambia el tipo de día para poder agregar ejercicios."}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-ink">Ejercicios</Text>
              <Text className="text-xs text-muted">En orden de ejecución</Text>
            </View>
            {day.targets.length === 0 && (
              <View className="items-center gap-2 rounded-2xl border border-dashed border-line px-5 py-8">
                <Text className="text-2xl text-accent">＋</Text>
                <Text className="text-base font-semibold text-ink">
                  Empieza con un ejercicio
                </Text>
                <Text className="text-center text-sm leading-6 text-muted">
                  Elige del catálogo y ajusta las series y repeticiones a tu
                  objetivo.
                </Text>
              </View>
            )}
            {day.targets.map((target, index) => (
              <TargetRow
                key={target.id}
                weekday={weekday}
                target={target}
                position={index + 1}
                isFirst={index === 0}
                isLast={index === day.targets.length - 1}
              />
            ))}
            <Button
              label="+ Agregar ejercicio"
              variant="primary"
              onPress={() =>
                router.push({
                  pathname: "/exercise-picker",
                  params: { mode: "template", day: String(weekday) },
                })
              }
            />
          </View>
        )}
        <Text className="text-center text-xs text-muted">
          ✓ Los cambios se guardan automáticamente
        </Text>
      </View>
    </ScrollView>
  );
}
