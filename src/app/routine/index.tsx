import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DayTypeChip } from "@/components/DayTypeChip";
import { getExercise, muscleLabel } from "@/data/catalog";
import { useToday } from "@/hooks/useToday";
import { WEEKDAYS, WEEKDAY_NAMES } from "@/lib/dates";
import { useWorkoutStore } from "@/store/useWorkoutStore";

export default function RoutineScreen() {
  const router = useRouter();
  const { weekday: today } = useToday();
  const template = useWorkoutStore((s) => s.template);
  const training = WEEKDAYS.filter((d) => template[d].dayType !== "descanso");
  const exercises = training.reduce(
    (sum, d) => sum + template[d].targets.length,
    0,
  );

  return (
    <ScrollView contentContainerClassName="pb-12">
      <View className="mx-auto w-full max-w-[960px] gap-6 p-5 md:p-8">
        <View className="gap-2">
          <Text className="text-[10px] font-bold tracking-[3px] text-accent">
            DISEÑA TU PROGRESO
          </Text>
          <Text className="text-3xl font-bold tracking-tight text-ink">
            Tu semana, a tu ritmo.
          </Text>
          <Text className="text-sm leading-6 text-muted">
            Organiza tus días. Ajusta tus objetivos. Hazlo tuyo.
          </Text>
        </View>
        <View className="flex-row rounded-2xl border border-line bg-surface py-5">
          {[
            ["ENTRENO", training.length],
            ["DESCANSO", 7 - training.length],
            ["EJERCICIOS", exercises],
          ].map(([label, value], i) => (
            <View
              key={label}
              className={`flex-1 items-center gap-1.5 ${i ? "border-l border-line" : ""}`}
            >
              <Text
                className={`text-2xl font-semibold ${i === 0 ? "text-accent" : "text-ink"}`}
              >
                {String(value).padStart(2, "0")}
              </Text>
              <Text className="text-[9px] font-semibold tracking-[1.5px] text-muted">
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View className="gap-3">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-ink">
              Plan semanal
            </Text>
            <Text className="text-xs text-muted">Toca un día para editar</Text>
          </View>
          {WEEKDAYS.map((weekday) => {
            const day = template[weekday];
            const rest = day.dayType === "descanso";
            const current = weekday === today;
            const muscles = [
              ...new Set(
                day.targets
                  .map((t) => {
                    const e = getExercise(t.exerciseSlug);
                    return e ? muscleLabel(e.muscleGroup) : "";
                  })
                  .filter(Boolean),
              ),
            ];
            return (
              <Pressable
                key={weekday}
                onPress={() =>
                  router.push({
                    pathname: "/routine/[day]",
                    params: { day: String(weekday) },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAY_NAMES[weekday]}${current ? ", hoy" : ""}, ${rest ? "descanso" : `${day.targets.length} ejercicios`}`}
                className={`flex-row items-center gap-3 rounded-2xl border p-4 active:opacity-70 md:gap-5 ${current ? "border-accent/50 bg-accent/5" : "border-line bg-surface hover:bg-elevated"}`}
              >
                <View
                  className={`h-12 w-11 items-center justify-center rounded-xl ${current ? "bg-accent" : "bg-elevated"}`}
                >
                  <Text
                    className={`text-sm font-bold ${current ? "text-bg" : "text-muted"}`}
                  >
                    {String(weekday).padStart(2, "0")}
                  </Text>
                </View>
                <View className="min-w-0 flex-1 gap-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-semibold text-ink">
                      {WEEKDAY_NAMES[weekday]}
                    </Text>
                    {current && (
                      <Text className="text-[10px] font-bold text-accent">
                        HOY
                      </Text>
                    )}
                  </View>
                  <Text numberOfLines={1} className="text-xs text-muted">
                    {rest
                      ? "Recupera energía"
                      : day.targets.length
                        ? `${day.targets.length} ejercicios · ${muscles.join(" / ")}`
                        : "Tu próximo entrenamiento empieza aquí"}
                  </Text>
                  <DayTypeChip dayType={day.dayType} />
                </View>
                <Text
                  className={`text-xl ${current ? "text-accent" : "text-muted"}`}
                >
                  ↗
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View className="flex-row items-start gap-3 rounded-2xl bg-surface p-4">
          <Text className="text-base text-accent">✓</Text>
          <Text className="flex-1 text-xs leading-5 text-muted">
            Guardado automático en este dispositivo. Los cambios en tu plan no
            modifican las sesiones que ya registraste.
          </Text>
        </View>
        <Text className="text-center text-[10px] leading-4 text-muted">
          Ilustraciones: Workout Guide por Bryl Lim (CC BY-SA 4.0), basadas en
          arte de Everkinetic.
        </Text>
      </View>
    </ScrollView>
  );
}
