import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ExerciseThumb } from "@/components/ExerciseThumb";
import { ChallengeCard } from "@/components/ChallengeCard";
import { WeekNavigator } from "@/components/WeekNavigator";
import { getExercise } from "@/data/catalog";
import { volumeGroupOf } from "@/data/volumeGroups";
import { useLifts } from "@/hooks/useLifts";
import { useToday } from "@/hooks/useToday";
import {
  WEEKDAYS,
  WEEKDAY_NAMES,
  toDateKey,
  addDays,
  formatWeekRange,
  startOfWeek,
} from "@/lib/dates";
import { pickChallenge } from "@/progress/challenge";
import {
  HARD_SET_MIN_REPS,
  VOLUME_MAX_SETS,
  VOLUME_MIN_SETS,
  STALE_WEEKS,
} from "@/progress/config";
import type { LiftSummary, VolumeRow } from "@/progress/types";
import { weeklyVolume } from "@/progress/volume";
import { useWorkoutStore } from "@/store/useWorkoutStore";

/** Escala de la barra de volumen: hasta este número de series por grupo. */
const VOLUME_SCALE = 24;

const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Hub de progreso: reto del día, volumen semanal por músculo y PRs / estancados por ejercicio. */
export default function ProgressScreen() {
  const router = useRouter();
  const lifts = useLifts();
  const challenge = useMemo(() => pickChallenge(lifts), [lifts]);

  return (
    <ScrollView contentContainerClassName="pb-12">
      <View className="mx-auto w-full max-w-[1000px] gap-6 p-5 md:p-8">
        <View className="gap-2">
          <Text className="text-[10px] font-bold tracking-[3px] text-accent">
            CADA SERIE CUENTA
          </Text>
          <Text className="text-3xl font-bold tracking-tight text-ink">
            Mira cuánto has avanzado.
          </Text>
          <Text className="text-sm leading-6 text-muted">
            Tu constancia se convierte en progreso. Aquí puedes verlo.
          </Text>
        </View>
        <VolumeSection />
        {challenge && (
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

        <View className="gap-3">
          <View className="gap-1">
            <Text className="text-xl font-semibold text-ink">
              Tus mejores marcas
            </Text>
            <Text className="text-xs text-muted">
              Historial de fuerza · récords y ejercicios por mejorar
            </Text>
          </View>
          {lifts.length === 0 ? (
            <View className="items-center gap-4 rounded-3xl border border-line bg-surface p-7">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                <Text className="text-3xl text-accent">↗</Text>
              </View>
              <View className="gap-2">
                <Text className="text-center text-lg font-semibold text-ink">
                  Tu primera marca te espera
                </Text>
                <Text className="max-w-[420px] text-center text-sm leading-6 text-muted">
                  Registra una serie de fuerza para establecer tu punto de
                  partida. Tus próximos récords aparecerán aquí.
                </Text>
              </View>
              <Button
                label="Ir a mi entrenamiento →"
                onPress={() => router.push("/")}
              />
            </View>
          ) : (
            lifts.map((lift) => (
              <LiftRow
                key={lift.exerciseSlug}
                lift={lift}
                onPress={() =>
                  router.push({
                    pathname: "/lift/[slug]",
                    params: { slug: lift.exerciseSlug },
                  })
                }
              />
            ))
          )}
          <Text className="text-xs text-muted">
            Solo cuentan las sesiones de fuerza. Un ejercicio se marca estancado
            tras {STALE_WEEKS} semanas sin superar tu mejor marca (1RM estimado
            con la fórmula de Epley).
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Volumen semanal ──────────────────────────────────────────────────────────

function VolumeSection() {
  const { now } = useToday();
  const sessions = useWorkoutStore((s) => s.sessions);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStartMs = startOfWeek(addDays(now, weekOffset * 7)).getTime();
  const rows = useMemo(
    () => weeklyVolume(sessions, new Date(weekStartMs), volumeGroupOf),
    [sessions, weekStartMs],
  );
  const [showDetails, setShowDetails] = useState(false);
  const startKey = toDateKey(new Date(weekStartMs));
  const endKey = toDateKey(addDays(new Date(weekStartMs), 7));
  const weekSessions = sessions.filter(
    (s) => s.date >= startKey && s.date < endKey,
  );
  const activity = WEEKDAYS.map((d) => {
    const key = toDateKey(addDays(new Date(weekStartMs), d - 1));
    return weekSessions
      .filter((s) => s.date === key)
      .reduce(
        (n, s) => n + s.exercises.reduce((n, e) => n + e.sets.length, 0),
        0,
      );
  });
  const total = activity.reduce((n, value) => n + value, 0);
  const activeDays = activity.filter((value) => value > 0).length;
  const trained = rows.filter((row) => row.sets > 0).length;
  const inRange = rows.filter((row) => row.status === "en rango").length;
  const evaluated = rows.filter((row) => row.status !== "sin objetivo").length;
  const maxActivity = Math.max(1, ...activity);

  return (
    <View className="gap-5">
      <View className="self-start rounded-2xl border border-line bg-surface p-2">
        <WeekNavigator
          label={formatWeekRange(new Date(weekStartMs))}
          isCurrent={weekOffset === 0}
          onPrevious={() => setWeekOffset((o) => o - 1)}
          onNext={() => setWeekOffset((o) => Math.min(0, o + 1))}
        />
      </View>
      <View className="flex-row flex-wrap gap-3">
        {[
          {
            label: "SERIES REGISTRADAS",
            value: total,
            detail: "Fuerza + funcional",
            accent: true,
          },
          {
            label: "DÍAS ACTIVOS",
            value: activeDays,
            detail: "Con series registradas",
          },
          {
            label: "MÚSCULOS TRABAJADOS",
            value: trained,
            detail: "Con series de fuerza",
          },
        ].map((item) => (
          <View
            key={item.label}
            className={`min-w-[135px] flex-1 gap-4 rounded-2xl border p-5 ${item.accent ? "border-accent bg-accent" : "border-line bg-surface"}`}
          >
            <Text
              className={`text-[9px] font-bold tracking-[1px] ${item.accent ? "text-bg/70" : "text-muted"}`}
            >
              {item.label}
            </Text>
            <View className="gap-1">
              <Text
                className={`text-3xl font-bold ${item.accent ? "text-bg" : "text-ink"}`}
              >
                {String(item.value).padStart(2, "0")}
              </Text>
              <Text
                className={`text-xs ${item.accent ? "text-bg/70" : "text-muted"}`}
              >
                {item.detail}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View className="gap-4 md:flex-row">
        <View className="flex-1 gap-5 rounded-3xl border border-line bg-surface p-5">
          <View className="gap-1">
            <Text className="text-lg font-semibold text-ink">
              Tu ritmo semanal
            </Text>
            <Text className="text-xs text-muted">
              Series registradas por día
            </Text>
          </View>
          <View className="h-36 flex-row items-end gap-3">
            {activity.map((value, i) => (
              <View
                key={i}
                accessible
                accessibilityLabel={`${WEEKDAY_NAMES[WEEKDAYS[i]]}: ${value} series`}
                className="flex-1 items-center gap-2"
              >
                <Text
                  className={`text-xs ${value ? "text-accent" : "text-muted"}`}
                >
                  {value}
                </Text>
                <View
                  className="w-full max-w-[30px] overflow-hidden rounded-lg bg-elevated"
                  style={{ height: 72 }}
                >
                  <View
                    className="absolute bottom-0 w-full rounded-lg bg-accent"
                    style={{ height: `${(value / maxActivity) * 100}%` }}
                  />
                </View>
                <Text className="text-[10px] text-muted">
                  {WEEKDAY_NAMES[WEEKDAYS[i]].slice(0, 3)}
                </Text>
              </View>
            ))}
          </View>
          <Text className="text-xs leading-5 text-muted">
            {total
              ? "Cada barra es un día en el que elegiste avanzar."
              : "Tu actividad aparecerá al registrar tus primeras series."}
          </Text>
        </View>
        <View className="flex-1 justify-between gap-5 rounded-3xl border border-line bg-surface p-5">
          <View className="gap-1">
            <Text className="text-lg font-semibold text-ink">
              Equilibrio muscular
            </Text>
            <Text className="text-xs text-muted">
              Grupos dentro del rango de volumen
            </Text>
          </View>
          <View className="flex-row items-end gap-2">
            <Text className="text-5xl font-semibold tracking-tight text-accent">
              {inRange}
            </Text>
            <Text className="pb-1 text-lg text-muted">
              / {evaluated} grupos
            </Text>
          </View>
          <View
            className="flex-row gap-1.5"
            accessible
            accessibilityLabel={`${inRange} de ${evaluated} grupos en rango`}
          >
            {Array.from({ length: evaluated }, (_, i) => (
              <View
                key={i}
                className={`h-8 flex-1 rounded-md ${i < inRange ? "bg-accent" : "bg-elevated"}`}
              />
            ))}
          </View>
          <Text className="text-xs leading-5 text-muted">
            Rango de referencia: {VOLUME_MIN_SETS}–{VOLUME_MAX_SETS} series de
            fuerza por grupo y semana.
          </Text>
        </View>
      </View>
      <View className="gap-5 rounded-3xl border border-line bg-surface p-5 md:p-6">
        <View className="gap-1">
          <Text className="text-xl font-semibold text-ink">
            Volumen por músculo
          </Text>
          <Text className="text-xs leading-5 text-muted">
            La banda sombreada indica el rango de {VOLUME_MIN_SETS}–
            {VOLUME_MAX_SETS} series.
          </Text>
        </View>
        <View className="gap-5">
          {rows.map((row) => (
            <VolumeBar key={row.group} row={row} />
          ))}
        </View>
        <View className="border-t border-line pt-3">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showDetails }}
            onPress={() => setShowDetails((value) => !value)}
            className="min-h-11 flex-row items-center justify-between"
          >
            <Text className="text-xs font-semibold text-muted">
              Cómo se calcula el volumen
            </Text>
            <Text className="text-lg text-accent">
              {showDetails ? "−" : "+"}
            </Text>
          </Pressable>
          {showDetails && (
            <Text className="text-xs leading-5 text-muted">
              Cuenta cada serie de fuerza con {HARD_SET_MIN_REPS}+ repeticiones,
              incluso en sesiones en curso. Se atribuye al músculo principal.
              Sin RPE no se distinguen los calentamientos. Las barras llegan
              hasta {VOLUME_SCALE} series; el número muestra el total real. Los
              grupos sin objetivo no se incluyen en el equilibrio muscular.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function VolumeBar({ row }: { row: VolumeRow }) {
  const pct = (sets: number) =>
    `${(Math.min(sets, VOLUME_SCALE) / VOLUME_SCALE) * 100}%` as const;
  const status =
    row.status === "sin objetivo"
      ? "Sin objetivo"
      : row.sets === 0
        ? "Sin registrar"
        : row.status === "en rango"
          ? "En rango"
          : row.status === "alto"
            ? "Sobre el rango"
            : `Faltan ${row.missing}`;
  const color =
    row.sets === 0 || row.status === "sin objetivo"
      ? "text-muted"
      : row.status === "en rango"
        ? "text-accent"
        : "text-funcional";
  return (
    <View
      className="gap-2"
      accessible
      accessibilityLabel={`${row.label}: ${row.sets} series, ${status}`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-sm font-medium text-ink">{row.label}</Text>
        <View className="flex-row items-center gap-3">
          <Text className={`text-[10px] ${color}`}>{status}</Text>
          <Text className="text-xs font-semibold text-ink">
            {row.sets} series
          </Text>
        </View>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-elevated">
        {row.status !== "sin objetivo" && (
          <View
            className="absolute h-full bg-line"
            style={{
              left: pct(VOLUME_MIN_SETS),
              width: pct(VOLUME_MAX_SETS - VOLUME_MIN_SETS),
            }}
          />
        )}
        <View
          className={`h-full rounded-full ${row.status === "alto" ? "bg-funcional" : "bg-accent"}`}
          style={{ width: pct(row.sets) }}
        />
      </View>
    </View>
  );
}

// ── Lista de ejercicios ──────────────────────────────────────────────────────

function LiftRow({
  lift,
  onPress,
}: {
  lift: LiftSummary;
  onPress: () => void;
}) {
  const name = getExercise(lift.exerciseSlug)?.name ?? lift.exerciseSlug;
  const best =
    lift.kind === "bodyweight"
      ? `${lift.best.value} reps`
      : `${kg(lift.best.value)} kg · ${lift.best.isTrue ? "1RM real" : "1RM est."}`;

  // Con una sola sesión no hay nada que superar: es una línea base, no un PR.
  const badge = lift.stale
    ? { text: `Estancado ${lift.weeksSincePr} sem`, cls: "text-funcional" }
    : lift.sessions === 1
      ? { text: "Línea base", cls: "text-muted" }
      : lift.weeksSincePr === 0
        ? { text: "PR esta semana", cls: "text-accent" }
        : { text: `PR hace ${lift.weeksSincePr} sem`, cls: "text-muted" };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 active:opacity-70"
    >
      <ExerciseThumb slug={lift.exerciseSlug} size={44} />
      <View className="flex-1 gap-2">
        <Text className="text-base font-semibold text-ink" numberOfLines={2}>
          {name}
        </Text>
        <Text className="text-xs text-muted">{best}</Text>
        <View className="gap-1">
          <Text className={`text-xs font-semibold ${badge.cls}`}>
            {badge.text}
          </Text>
          {lift.repPrs.length > 0 && (
            <Text className="text-xs text-accent">▲ PR de reps</Text>
          )}
        </View>
      </View>
      <Text className="text-xl text-accent">↗</Text>
    </Pressable>
  );
}
