import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { ChallengeCard } from "@/components/ChallengeCard";
import { DayTypeChip } from "@/components/DayTypeChip";
import { ExerciseThumb } from "@/components/ExerciseThumb";
import { SessionExerciseCard } from "@/components/SessionExerciseCard";
import palette from "@/constants/palette.json";
import { getExercise, muscleLabel } from "@/data/catalog";
import { useLifts } from "@/hooks/useLifts";
import { useToday } from "@/hooks/useToday";
import {
  WEEKDAYS,
  WEEKDAY_NAMES,
  addDays,
  startOfWeek,
  toDateKey,
  formatLongDate,
  formatTime,
  formatMinutes,
} from "@/lib/dates";
import { formatTarget } from "@/lib/format";
import { pickChallenge } from "@/progress/challenge";
import { useStoreHydrated, useWorkoutStore } from "@/store/useWorkoutStore";
import type { ExerciseTarget, Session } from "@/types";

const NAV = [
  { label: "Inicio", icon: "⌂", path: "/" },
  { label: "Mi rutina", icon: "▦", path: "/routine" },
  { label: "Progreso", icon: "↗", path: "/progress" },
  { label: "Fit Score", icon: "◎", path: "/score" },
  { label: "Salud", icon: "♡", path: "/health" },
] as const;

export default function TodayScreen() {
  const router = useRouter();
  const hydrated = useStoreHydrated();
  const { width } = useWindowDimensions();
  const desktop = width >= 1100;
  const { now, dateKey, weekday } = useToday();
  const template = useWorkoutStore((s) => s.template);
  const sessions = useWorkoutStore((s) => s.sessions);
  const day = template[weekday];
  const session = sessions.find((x) => x.date === dateKey);
  const startTodaySession = useWorkoutStore((s) => s.startTodaySession);
  const lifts = useLifts();
  const challenge = useMemo(() => pickChallenge(lifts), [lifts]);
  const weekStart = startOfWeek(now);
  const weekEndKey = toDateKey(addDays(weekStart, 7));
  const completed = sessions.filter(
    (s) =>
      s.finishedAt && s.date >= toDateKey(weekStart) && s.date < weekEndKey,
  );
  const planned = WEEKDAYS.filter(
    (d) => template[d].dayType !== "descanso",
  ).length;
  const sets = completed.reduce(
    (n, s) => n + s.exercises.reduce((n, e) => n + e.sets.length, 0),
    0,
  );
  const minutes = Math.round(
    completed.reduce(
      (n, s) =>
        n +
        Math.max(
          0,
          new Date(s.finishedAt!).getTime() - new Date(s.startedAt).getTime(),
        ),
      0,
    ) / 60000,
  );
  const rest = day.dayType === "descanso" && !session;
  const editToday = () =>
    router.push({
      pathname: "/routine/[day]",
      params: { day: String(weekday) },
    });

  // El HTML estático no conoce la fecha local, el viewport ni las sesiones guardadas.
  if (!hydrated) return <View className="flex-1 bg-bg" />;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "bottom"]}>
      <View className="flex-1 flex-row">
        {desktop && (
          <View className="w-60 border-r border-line bg-surface px-5 py-9">
            <Brand />
            <Text className="mb-5 mt-14 px-4 text-[10px] font-bold tracking-[3px] text-muted">
              TU ESPACIO
            </Text>
            <View className="gap-2">
              {NAV.map((item, i) => (
                <Pressable
                  key={item.path}
                  accessibilityRole="button"
                  accessibilityState={{ selected: i === 0 }}
                  onPress={() => router.push(item.path)}
                  className={`flex-row items-center gap-4 rounded-2xl px-4 py-4 hover:bg-elevated ${i === 0 ? "bg-accent" : ""}`}
                >
                  <Text
                    className={`text-2xl ${i === 0 ? "text-bg" : "text-muted"}`}
                  >
                    {item.icon}
                  </Text>
                  <Text
                    className={`text-sm font-semibold ${i === 0 ? "text-bg" : "text-muted"}`}
                  >
                    {item.label}
                  </Text>
                  {i === 0 && (
                    <View className="ml-auto h-1.5 w-1.5 rounded-full bg-bg" />
                  )}
                </Pressable>
              ))}
            </View>
            <View className="mt-auto gap-4 rounded-2xl border border-line p-5">
              <Text className="text-2xl text-accent">↗</Text>
              <Text className="text-base font-semibold text-ink">
                Tu único rival eres tú.
              </Text>
              <Text className="text-xs leading-5 text-muted">
                Cada serie cuenta. Construye tu mejor versión, un día a la vez.
              </Text>
            </View>
            <Text className="mt-6 px-2 text-[10px] tracking-[2px] text-muted">
              GYM / HECHO PARA AVANZAR
            </Text>
          </View>
        )}
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View className="mx-auto w-full max-w-[1440px] gap-7 px-5 py-6 md:px-10 md:py-9">
            <View className="flex-row items-center justify-between gap-3">
              <View className="gap-2">
                {!desktop && <Brand />}
                <Text className="text-xs font-medium uppercase tracking-[2px] text-muted">
                  TU ENTRENAMIENTO, TU RITMO
                </Text>
                <Text className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
                  Vamos por más<Text className="text-accent">.</Text>
                </Text>
              </View>
              {width >= 650 && (
                <View className="flex-row items-center gap-3 rounded-full border border-line px-4 py-3">
                  <View className="h-2 w-2 rounded-full bg-accent" />
                  <Text className="text-sm text-muted">
                    {WEEKDAY_NAMES[weekday]}, {formatLongDate(now)}
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-row flex-wrap gap-3 md:gap-4">
              <Metric
                label="ENTRENAMIENTOS"
                value={String(completed.length).padStart(2, "0")}
                detail={`/ ${planned} planeados esta semana`}
                icon="↗"
                accent
              />
              <Metric
                label="TIEMPO ACTIVO"
                value={formatMinutes(minutes)}
                detail="en sesiones completadas"
                icon="◷"
              />
              <Metric
                label="SERIES REGISTRADAS"
                value={String(sets).padStart(2, "0")}
                detail="esta semana · cada una cuenta"
                icon="≋"
              />
            </View>

            <View className="gap-6 xl:flex-row">
              <View className="min-w-0 flex-1 gap-7">
                <ImageBackground
                  source={require("../../assets/images/training-floor.jpg")}
                  imageStyle={{ opacity: 0.4, borderRadius: 24 }}
                  className="overflow-hidden rounded-3xl bg-surface"
                >
                  <View className="min-h-[300px] justify-between gap-8 bg-black/30 p-6 md:min-h-[340px] md:p-8">
                    <View className="flex-row items-center justify-between">
                      <View className="rounded-full border border-white/20 bg-black/40 px-3 py-2">
                        <Text className="text-[10px] font-bold tracking-[2px] text-accent">
                          {session ? "TU SESIÓN DE HOY" : "HOY ES UN BUEN DÍA"}
                        </Text>
                      </View>
                      <DayTypeChip dayType={session?.dayType ?? day.dayType} />
                    </View>
                    <View className="items-start gap-4">
                      <Text className="text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
                        {rest
                          ? "Recupera hoy.\nVuelve más fuerte."
                          : "Un paso más.\nUna versión mejor."}
                      </Text>
                      <Text className="max-w-[350px] text-sm leading-6 text-white/80">
                        {rest
                          ? "El descanso también es parte del progreso. Dale a tu cuerpo el espacio que necesita."
                          : "Tu plan está listo. Concéntrate en lo que importa: superar tus propias marcas."}
                      </Text>
                      {!session && (
                        <Button
                          label={
                            rest
                              ? "Ver mi rutina  ↗"
                              : "Iniciar entrenamiento  →"
                          }
                          onPress={
                            rest
                              ? () => router.push("/routine")
                              : () => startTodaySession(now)
                          }
                          className="mt-1 px-6"
                        />
                      )}
                      {session && (
                        <View className="rounded-full bg-accent px-4 py-2">
                          <Text className="text-sm font-semibold text-bg">
                            {session.finishedAt
                              ? "✓ Entrenamiento completado"
                              : "● Sesión en curso · registra tus series abajo"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </ImageBackground>

                <View className="gap-4">
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="gap-1">
                      <Text className="text-xl font-semibold text-ink">
                        {session ? "Tu sesión" : "Tu plan de hoy"}
                      </Text>
                      <Text className="text-xs text-muted">
                        {WEEKDAY_NAMES[weekday]} · {formatLongDate(now)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={editToday}
                      className="rounded-full border border-line px-4 py-2.5 hover:bg-elevated"
                    >
                      <Text className="text-xs font-medium text-ink">
                        Editar rutina ↗
                      </Text>
                    </Pressable>
                  </View>
                  {session ? (
                    <ActiveSession session={session} />
                  ) : rest ? (
                    <RestCard />
                  ) : (
                    <PlanPreview
                      targets={day.targets}
                      onStart={() => startTodaySession(now)}
                      onEditRoutine={editToday}
                    />
                  )}
                </View>
              </View>

              <View className="gap-5 xl:w-[320px]">
                <View className="gap-5 rounded-3xl border border-line bg-surface p-5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-lg font-semibold text-ink">
                      Tu semana
                    </Text>
                    <Text className="text-xs text-muted">
                      {formatLongDate(now)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between gap-1">
                    {WEEKDAYS.map((d) => {
                      const date = addDays(weekStart, d - 1);
                      const done = completed.some(
                        (s) => s.date === toDateKey(date),
                      );
                      return (
                        <Pressable
                          key={d}
                          accessibilityRole="button"
                          accessibilityLabel={`Ver rutina del ${WEEKDAY_NAMES[d]}`}
                          onPress={() =>
                            router.push({
                              pathname: "/routine/[day]",
                              params: { day: String(d) },
                            })
                          }
                          className={`flex-1 items-center gap-3 rounded-xl py-3 ${d === weekday ? "bg-accent" : "bg-elevated"}`}
                        >
                          <Text
                            className={`text-[10px] ${d === weekday ? "text-bg" : "text-muted"}`}
                          >
                            {WEEKDAY_NAMES[d].slice(0, 3)}
                          </Text>
                          <Text
                            className={`text-base font-semibold ${d === weekday ? "text-bg" : "text-ink"}`}
                          >
                            {date.getDate()}
                          </Text>
                          <View
                            className={`h-1 w-1 rounded-full ${done ? "bg-funcional" : d === weekday ? "bg-bg" : template[d].dayType !== "descanso" ? "bg-muted" : "bg-transparent"}`}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                  <View className="gap-3 border-t border-line pt-4">
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-muted">
                        Sesiones completadas
                      </Text>
                      <Text className="text-xs font-semibold text-accent">
                        {completed.length} / {planned}
                      </Text>
                    </View>
                    <View className="h-1.5 overflow-hidden rounded-full bg-elevated">
                      <View
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${planned ? Math.min(100, (completed.length / planned) * 100) : 0}%`,
                        }}
                      />
                    </View>
                    <Text className="text-xs leading-5 text-muted">
                      {completed.length
                        ? "Sigue sumando. Tu constancia hace la diferencia."
                        : "Una nueva semana para construir tu progreso."}
                    </Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/score")}
                  className="gap-4 rounded-3xl bg-accent p-6 active:opacity-80"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold tracking-[2px] text-bg">
                      CONOCE TU RENDIMIENTO
                    </Text>
                    <Text className="text-xl text-bg">↗</Text>
                  </View>
                  <Text className="text-3xl font-bold tracking-tight text-bg">
                    Tu Fit Score
                  </Text>
                  <Text className="text-sm leading-6 text-bg/75">
                    Entrenamiento, recuperación y progreso. Una mirada a tu
                    evolución.
                  </Text>
                  <View className="self-start rounded-full bg-bg px-4 py-2.5">
                    <Text className="text-xs font-semibold text-accent">
                      Explorar mi score →
                    </Text>
                  </View>
                </Pressable>

                {!session && challenge && (
                  <ChallengeCard
                    challenge={challenge}
                    onPress={
                      challenge.kind === "stale"
                        ? () =>
                            router.push({
                              pathname: "/lift/[slug]",
                              params: { slug: challenge.exerciseSlug },
                            })
                        : undefined
                    }
                  />
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/health")}
                  className="flex-row items-center gap-4 rounded-2xl border border-line bg-surface p-5 hover:bg-elevated"
                >
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-elevated">
                    <Text className="text-2xl text-accent">♡</Text>
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-sm font-semibold text-ink">
                      Conecta con tu cuerpo
                    </Text>
                    <Text className="text-xs text-muted">
                      Explora Apple Health
                    </Text>
                  </View>
                  <Text className="text-xl text-muted">↗</Text>
                </Pressable>
              </View>
            </View>
            <View className="flex-row justify-between border-t border-line pt-5">
              <Text className="text-[10px] tracking-[2px] text-muted">
                MENOS EXCUSAS. MÁS PROGRESO.
              </Text>
              <Text className="text-[10px] text-muted">Un día a la vez.</Text>
            </View>
          </View>
        </ScrollView>
      </View>
      {!desktop && (
        <View className="flex-row border-t border-line bg-surface px-2 py-3">
          {NAV.map((item, i) => (
            <Pressable
              key={item.path}
              accessibilityRole="button"
              accessibilityState={{ selected: i === 0 }}
              onPress={() => router.push(item.path)}
              className="flex-1 items-center gap-1 py-1"
            >
              <Text
                className={`text-2xl ${i === 0 ? "text-accent" : "text-muted"}`}
              >
                {item.icon}
              </Text>
              <Text
                className={`text-[10px] ${i === 0 ? "text-accent" : "text-muted"}`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

function Brand() {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-accent">
        <Text className="text-xl font-black text-bg">↗</Text>
      </View>
      <Text className="text-2xl font-black tracking-tight text-ink">
        gym<Text className="text-accent">.</Text>
      </Text>
      <Text className="ml-1 text-[9px] tracking-[2px] text-muted">
        TRAINING CLUB
      </Text>
    </View>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <View className="min-w-[150px] flex-1 gap-4 rounded-2xl border border-line bg-surface p-5">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-[10px] font-semibold tracking-[1.5px] text-muted">
          {label}
        </Text>
        <Text className={`text-xl ${accent ? "text-accent" : "text-muted"}`}>
          {icon}
        </Text>
      </View>
      <View className="gap-1.5">
        <Text
          className={`text-3xl font-semibold tracking-tight ${accent ? "text-accent" : "text-ink"}`}
        >
          {value}
        </Text>
        <Text className="text-xs text-muted">{detail}</Text>
      </View>
    </View>
  );
}

/** Hoy es descanso y no hay sesión registrada. */
function RestCard() {
  return (
    <View className="items-center gap-2 rounded-2xl border border-line bg-surface px-6 py-10">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-accent/10">
        <Text className="text-3xl text-accent">☾</Text>
      </View>
      <Text className="text-xl font-bold text-ink">Día de descanso</Text>
      <Text className="text-center text-sm text-muted">
        Hoy toca recuperar. Si quieres entrenar, cambia el tipo de este día
        desde “Mi rutina”.
      </Text>
    </View>
  );
}

/** Aún no se inicia la sesión: se muestra el plan de hoy (viene de la plantilla). */
function PlanPreview({
  targets,
  onStart,
  onEditRoutine,
}: {
  targets: ExerciseTarget[];
  onStart: () => void;
  onEditRoutine: () => void;
}) {
  return (
    <View className="gap-4">
      {targets.length === 0 ? (
        <View className="gap-3 rounded-2xl border border-dashed border-line bg-surface p-5">
          <Text className="text-base text-ink">
            Este día no tiene ejercicios en tu plantilla.
          </Text>
          <Text className="text-sm text-muted">
            Puedes iniciar la sesión y agregar lo que hagas hoy, o llenar la
            plantilla para que quede como plan fijo.
          </Text>
          <Button
            label="Editar la plantilla de hoy"
            variant="secondary"
            onPress={onEditRoutine}
          />
        </View>
      ) : (
        <View className="gap-2">
          {targets.map((target) => {
            const info = getExercise(target.exerciseSlug);
            return (
              <View
                key={target.id}
                className="flex-row items-center gap-4 rounded-2xl border border-line bg-surface p-4"
              >
                <ExerciseThumb slug={target.exerciseSlug} size={52} />
                <View className="flex-1 gap-0.5">
                  <Text
                    className="text-base font-semibold text-ink"
                    numberOfLines={2}
                  >
                    {info?.name ?? target.exerciseSlug}
                  </Text>
                  {info && (
                    <Text className="text-xs text-muted">
                      {muscleLabel(info.muscleGroup)}
                    </Text>
                  )}
                </View>
                <Text className="text-base font-bold text-accent">
                  {formatTarget(target)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <Button label="Iniciar entrenamiento" onPress={onStart} />
    </View>
  );
}

/** Sesión de hoy en curso (o ya guardada): registro de sets y ajustes solo de este día. */
function ActiveSession({ session }: { session: Session }) {
  const router = useRouter();
  const finishSession = useWorkoutStore((s) => s.finishSession);
  const reopenSession = useWorkoutStore((s) => s.reopenSession);

  const totalSets = session.exercises.reduce(
    (sum, e) => sum + e.sets.length,
    0,
  );

  return (
    <View className="gap-3">
      {session.exercises.length === 0 && (
        <View className="rounded-2xl border border-dashed border-line bg-surface p-5">
          <Text className="text-sm text-muted">
            La sesión no tiene ejercicios. Agrega los que vayas a hacer hoy.
          </Text>
        </View>
      )}

      {session.exercises.map((exercise) => (
        <SessionExerciseCard
          key={exercise.id}
          sessionId={session.id}
          exercise={exercise}
        />
      ))}

      <Button
        label="+ Agregar ejercicio a hoy"
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: "/exercise-picker",
            params: { mode: "session", sessionId: session.id },
          })
        }
      />
      <Text className="text-center text-xs text-muted">
        Los cambios de hoy no modifican tu plantilla semanal.
      </Text>

      <View className="mt-2 gap-3 border-t border-line pt-4">
        <Text className="text-center text-sm text-muted">
          {session.exercises.length} ejercicios · {totalSets} sets registrados
        </Text>
        {session.finishedAt ? (
          <>
            <View className="items-center rounded-xl bg-accent/15 py-3">
              <Text className="font-semibold text-accent">
                ✓ Sesión guardada a las {formatTime(session.finishedAt)}
              </Text>
            </View>
            <Button
              label="Reabrir sesión"
              variant="ghost"
              onPress={() => reopenSession(session.id)}
            />
          </>
        ) : (
          <Button
            label="Guardar sesión"
            disabled={totalSets === 0}
            onPress={() => finishSession(session.id)}
          />
        )}
      </View>
    </View>
  );
}
