import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/Button";
import { NumberField } from "@/components/NumberField";
import { WeekNavigator } from "@/components/WeekNavigator";
import palette from "@/constants/palette.json";
import { getExercise } from "@/data/catalog";
import { useFitScore } from "@/hooks/useFitScore";
import { useToday } from "@/hooks/useToday";
import { formatMinutes, formatWeekRange, toDateKey } from "@/lib/dates";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import type {
  BodyWeightSignal,
  ExerciseProgress,
  FitScore,
  IntensitySignal,
  ProgressionSignal,
  RecoverySignal,
  SignalBase,
} from "@/score/types";

/**
 * Fit Score semanal: el número, y debajo cada señal por separado con su peso y sus datos.
 * Todo lo calcula `src/score/engine.ts`; esta pantalla solo lo muestra.
 */
export default function ScoreScreen() {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const { fitScore, loading, healthStatus, weekStart, refresh } =
    useFitScore(weekOffset);

  return (
    <ScrollView
      contentContainerClassName="pb-12"
      keyboardShouldPersistTaps="handled"
    >
      <View className="mx-auto w-full max-w-[960px] gap-6 p-5 md:p-8">
        <View className="gap-2">
          <Text className="text-[10px] font-bold tracking-[3px] text-accent">
            ENTIENDE TU RENDIMIENTO
          </Text>
          <Text className="text-3xl font-bold tracking-tight text-ink">
            Tu esfuerzo, en perspectiva.
          </Text>
          <Text className="text-sm leading-6 text-muted">
            Entrenamiento y recuperación. Una visión de tu semana.
          </Text>
        </View>
        <View className="rounded-2xl border border-line bg-surface p-2">
          <WeekNavigator
            label={formatWeekRange(weekStart)}
            isCurrent={weekOffset === 0}
            onPrevious={() => setWeekOffset((o) => o - 1)}
            onNext={() => setWeekOffset((o) => Math.min(0, o + 1))}
            right={
              <Button
                label={loading ? "…" : "↻"}
                variant="secondary"
                disabled={loading}
                onPress={refresh}
                className="px-4 py-2.5"
              />
            }
          />
        </View>
        {loading || !fitScore ? (
          <View className="items-center py-16">
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : (
          <>
            <ScoreHero score={fitScore} />

            {healthStatus !== "ready" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/health")}
                className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-4"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/10">
                  <Text className="text-2xl text-accent">♡</Text>
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-semibold text-ink">
                    Completa tu visión con Salud
                  </Text>
                  <Text className="text-xs leading-5 text-muted">
                    {healthStatus === "needs-permission"
                      ? "Autoriza Apple Health para incluir recuperación e intensidad."
                      : "Los datos de Apple Health se conectan desde la app en iPhone."}
                  </Text>
                </View>
                <Text className="text-xl text-accent">↗</Text>
              </Pressable>
            )}

            <View className="gap-1">
              <Text className="text-xl font-semibold text-ink">
                Lo que construye tu score
              </Text>
              <Text className="text-xs leading-5 text-muted">
                Solo cuentan las señales con información suficiente.
              </Text>
            </View>
            <View className="gap-4 md:flex-row">
              <View className="min-w-0 flex-1 gap-4">
                <ProgressionCard signal={fitScore.progression} />
                <RecoveryCard signal={fitScore.recovery} />
              </View>
              <View className="min-w-0 flex-1 gap-4">
                <IntensityCard signal={fitScore.intensity} />
                <BodyWeightCard signal={fitScore.bodyWeight} />
              </View>
            </View>
            <BodyWeightLog />
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ── Encabezado ───────────────────────────────────────────────────────────────

/** Colores por rango de puntaje. Clases completas (no dinámicas) para que Tailwind las detecte. */
function tone(score: number): { text: string; bar: string } {
  if (score >= 70) return { text: "text-accent", bar: "bg-accent" };
  if (score >= 55) return { text: "text-funcional", bar: "bg-funcional" };
  return { text: "text-danger", bar: "bg-danger" };
}

function ScoreHero({ score }: { score: FitScore }) {
  const signals = [
    score.progression,
    score.recovery,
    score.intensity,
    score.bodyWeight,
  ];
  const available = signals.filter((signal) => signal.available).length;
  return (
    <View className="overflow-hidden rounded-3xl border border-accent/25 bg-surface">
      <View className="gap-6 p-6 md:p-8">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-xs font-bold tracking-[2px] text-accent">
            FIT SCORE
          </Text>
          <View className="rounded-full bg-elevated px-3 py-1.5">
            <Text className="text-[10px] text-muted">
              {score.isPartial ? "Semana en curso" : "Semana finalizada"}
            </Text>
          </View>
        </View>
        <View className="items-center gap-2">
          <View className="flex-row items-end gap-2">
            <Text
              className={`text-8xl font-bold tracking-tight ${score.score === null ? "text-muted" : tone(score.score).text}`}
            >
              {score.score ?? "—"}
            </Text>
            <Text className="mb-3 text-xl text-muted">/ 100</Text>
          </View>
          <Text className="text-xl font-semibold text-ink">
            {score.score === null
              ? "Tu punto de partida está por llegar"
              : score.label}
          </Text>
          {score.score === null && (
            <Text className="max-w-[420px] text-center text-sm leading-6 text-muted">
              {score.missingReason}
            </Text>
          )}
        </View>
        <View className="gap-2">
          <View
            className="flex-row gap-1"
            accessible
            accessibilityLabel={
              score.score === null
                ? "Score sin datos suficientes"
                : `Fit Score: ${score.score} de 100`
            }
          >
            {Array.from({ length: 25 }, (_, i) => (
              <View
                key={i}
                className={`h-9 flex-1 rounded-sm ${score.score !== null && i < Math.round(score.score / 4) ? tone(score.score).bar : "bg-elevated"}`}
              />
            ))}
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[10px] text-muted">0</Text>
            <Text className="text-[10px] text-muted">50</Text>
            <Text className="text-[10px] text-muted">100</Text>
          </View>
        </View>
        <Text className="text-center text-xs leading-5 text-muted">
          {score.isPartial
            ? "Resultado provisional: se actualiza con los registros de esta semana."
            : "Resultado calculado con los registros disponibles de esta semana."}
        </Text>
      </View>
      <View className="flex-row border-t border-line bg-elevated/40 py-5">
        {[
          { value: `${available}/4`, label: "SEÑALES ACTIVAS" },
          { value: `${Math.round(score.coverage * 100)}%`, label: "COBERTURA" },
          {
            value: String(score.sessions.fuerza + score.sessions.funcional),
            label: "SESIONES",
          },
        ].map((item, i) => (
          <View
            key={item.label}
            className={`flex-1 items-center gap-2 ${i ? "border-l border-line" : ""}`}
          >
            <Text className="text-xl font-semibold text-ink">{item.value}</Text>
            <Text className="text-[8px] font-semibold tracking-[1px] text-muted">
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Tarjetas por señal ───────────────────────────────────────────────────────

function SignalCard({
  title,
  caption,
  signal,
  children,
}: {
  title: string;
  caption: string;
  signal: SignalBase;
  children?: ReactNode;
}) {
  const score = signal.score;
  const [expanded, setExpanded] = useState(false);
  return (
    <View className="gap-4 rounded-3xl border border-line bg-surface p-5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-2">
          <Text className="text-base font-semibold text-ink">{title}</Text>
          <Text
            className={`text-[10px] font-medium ${signal.available ? "text-accent" : "text-muted"}`}
          >
            {signal.available
              ? `${Math.round(signal.weight * 100)} % del score`
              : "Pendiente de datos"}
          </Text>
        </View>
        <Text
          className={`text-3xl font-semibold ${score === null ? "text-muted" : tone(score).text}`}
        >
          {score ?? "—"}
        </Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-elevated">
        {score !== null && (
          <View
            className={`h-full rounded-full ${tone(score).bar}`}
            style={{ width: `${score}%` }}
          />
        )}
      </View>
      {signal.unavailableReason && (
        <Text className="text-sm leading-6 text-muted">
          {signal.unavailableReason}
        </Text>
      )}
      {children}
      <View className="border-t border-line pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cómo se calcula: ${title}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          className="min-h-11 flex-row items-center justify-between"
        >
          <Text className="text-xs text-muted">Cómo se calcula</Text>
          <Text className="text-lg text-accent">{expanded ? "−" : "+"}</Text>
        </Pressable>
        {expanded && (
          <View className="gap-2">
            <Text className="text-xs leading-5 text-muted">{caption}</Text>
            {!signal.available && (
              <Text className="text-xs leading-5 text-muted">
                Peso de referencia: {Math.round(signal.baseWeight * 100)} %.
                Esta señal no cuenta en el resultado actual.
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <View className="gap-0.5">
      <View className="flex-row justify-between gap-4">
        <Text className="text-sm text-muted">{label}</Text>
        <Text className="flex-1 text-right text-sm font-medium text-ink">
          {value}
        </Text>
      </View>
      {hint && <Text className="text-right text-xs text-muted">{hint}</Text>}
    </View>
  );
}

const signed = (n: number, digits = 0) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;

function ProgressionCard({ signal }: { signal: ProgressionSignal }) {
  return (
    <SignalCard
      title="Progresión de carga"
      caption="Cuánto cambió tu fuerza estimada vs. tus 4 semanas previas. Solo días de fuerza; si hay AMRAP, se compara AMRAP contra AMRAP."
      signal={signal}
    >
      {signal.exercises.map((exercise) => (
        <ExerciseRow key={exercise.exerciseSlug} exercise={exercise} />
      ))}
      {signal.newExercises.length > 0 && (
        <Text className="text-xs text-muted">
          Sin referencia (nuevos):{" "}
          {signal.newExercises
            .map((slug) => getExercise(slug)?.name ?? slug)
            .join(", ")}
        </Text>
      )}
    </SignalCard>
  );
}

function ExerciseRow({ exercise }: { exercise: ExerciseProgress }) {
  const arrow =
    exercise.status === "progreso"
      ? "▲"
      : exercise.status === "retroceso"
        ? "▼"
        : "＝";
  const color =
    exercise.status === "progreso"
      ? "text-accent"
      : exercise.status === "retroceso"
        ? "text-danger"
        : "text-muted";
  const set = (s: { weightKg: number; reps: number }) =>
    s.weightKg > 0 ? `${s.weightKg} kg × ${s.reps}` : `${s.reps} reps`;
  return (
    <View className="gap-0.5">
      <View className="flex-row justify-between gap-3">
        <Text className="flex-1 text-sm font-medium text-ink" numberOfLines={1}>
          {getExercise(exercise.exerciseSlug)?.name ?? exercise.exerciseSlug}
        </Text>
        <Text className={`text-sm font-bold ${color}`}>
          {arrow} {signed(exercise.deltaPct, 1)} %
        </Text>
      </View>
      <Text className="text-xs text-muted">
        {set(exercise.current)} vs {set(exercise.reference)}
        {exercise.basis === "amrap" ? " · AMRAP" : ""}
      </Text>
    </View>
  );
}

function RecoveryCard({ signal }: { signal: RecoverySignal }) {
  const { sleep, restingHr } = signal;
  return (
    <SignalCard
      title="Recuperación"
      caption="Sueño por noche y FC en reposo, comparados con tu promedio de las 4 semanas previas (si la FC en reposo sube, recuperas peor)."
      signal={signal}
    >
      {sleep && (
        <Row
          label="Sueño promedio"
          value={`${formatMinutes(sleep.avgMinutes)} · ${sleep.nights} ${sleep.nights === 1 ? "noche" : "noches"}`}
          hint={
            sleep.deltaMinutes === null
              ? "sin referencia previa"
              : `${signed(sleep.deltaMinutes)} min vs tu promedio`
          }
        />
      )}
      {restingHr ? (
        <Row
          label="FC en reposo"
          value={`${restingHr.avgBpm} bpm`}
          hint={`${signed(restingHr.deltaBpm, 1)} vs tu promedio (${restingHr.baselineAvgBpm})`}
        />
      ) : (
        signal.available && (
          <Text className="text-xs text-muted">
            FC en reposo: aún sin referencia suficiente.
          </Text>
        )
      )}
    </SignalCard>
  );
}

function IntensityCard({ signal }: { signal: IntensitySignal }) {
  return (
    <SignalCard
      title="Intensidad"
      caption="Solo días funcionales: FC media de la sesión respecto a tu FC máxima, y calorías por minuto respecto a tu mediana."
      signal={signal}
    >
      {signal.sessions.map((session) => (
        <View key={session.sessionId} className="gap-0.5">
          <Row
            label={`${session.date} · ${session.durationMinutes} min`}
            value={`${Math.round(session.hrFraction * 100)} % de tu FCmáx`}
            hint={
              `FC media ${session.avgHrBpm} bpm` +
              (session.kcalPerMin !== null
                ? ` · ${session.kcalPerMin} kcal/min`
                : "") +
              (session.energyRatio !== null
                ? ` (${session.energyRatio}× tu mediana)`
                : "")
            }
          />
        </View>
      ))}
      {signal.sessionsWithoutData > 0 && signal.available && (
        <Text className="text-xs text-muted">
          {signal.sessionsWithoutData} sesión(es) funcional(es) sin
          entrenamiento en Apple Health.
        </Text>
      )}
      {(signal.available || signal.sessions.length > 0) && (
        <Text className="text-xs text-muted">
          FC máxima{" "}
          {signal.maxHrSource === "observada" ? "observada" : "estimada"}:{" "}
          {signal.maxHrBpm} bpm
          {signal.maxHrSource === "estimada"
            ? " (faltan entrenamientos con FC para medirla)"
            : ""}
          .
        </Text>
      )}
    </SignalCard>
  );
}

function BodyWeightCard({ signal }: { signal: BodyWeightSignal }) {
  return (
    <SignalCard
      title="Peso corporal"
      caption="Tendencia de las últimas 4 semanas. Meta: ganar masa despacio (+0.1 a +0.5 % por semana puntúa mejor)."
      signal={signal}
    >
      {signal.latestKg !== null && (
        <Row label="Último registro" value={`${signal.latestKg} kg`} />
      )}
      {signal.pctPerWeek !== null && signal.changeKg !== null && (
        <Row
          label="Tendencia"
          value={`${signed(signal.pctPerWeek, 2)} % / semana`}
          hint={`${signed(signal.changeKg, 1)} kg en 4 semanas`}
        />
      )}
    </SignalCard>
  );
}

// ── Registro de peso corporal ────────────────────────────────────────────────

/** Entrada manual de peso (una por día) y las últimas mediciones. */
function BodyWeightLog() {
  const { dateKey } = useToday();
  const bodyWeights = useWorkoutStore((s) => s.bodyWeights);
  const setBodyWeight = useWorkoutStore((s) => s.setBodyWeight);
  const removeBodyWeight = useWorkoutStore((s) => s.removeBodyWeight);

  const latest = bodyWeights[bodyWeights.length - 1];
  const [draft, setDraft] = useState(latest?.weightKg ?? 0);
  const valid = draft >= 20 && draft <= 400;
  const recent = bodyWeights.slice(-5).reverse();

  return (
    <View className="gap-4 rounded-3xl border border-line bg-surface p-5 md:p-6">
      <View className="gap-1">
        <Text className="text-xl font-semibold text-ink">
          Un registro, un paso más
        </Text>
        <Text className="text-sm text-muted">
          Registra tu peso corporal de hoy.
        </Text>
      </View>
      <View className="flex-row flex-wrap items-center gap-3">
        <View className="min-w-[100px] flex-1">
          <NumberField
            decimal
            value={draft}
            onChange={setDraft}
            accessibilityLabel="Peso corporal en kilos"
          />
        </View>
        <Text className="text-sm text-muted">kg</Text>
        <Button
          label={
            bodyWeights.some((e) => e.date === dateKey)
              ? "Actualizar hoy"
              : "Guardar hoy"
          }
          disabled={!valid}
          onPress={() => setBodyWeight(dateKey, draft)}
          className="px-4 py-3"
        />
      </View>
      <Text className="text-xs leading-5 text-muted">
        Pésate en condiciones parecidas (por ejemplo, en ayunas). Se guarda una
        medición por día.
      </Text>
      {recent.map((entry) => (
        <View key={entry.id} className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">{entry.date}</Text>
          <Text className="text-sm font-medium text-ink">
            {entry.weightKg} kg
          </Text>
          <Pressable
            onPress={() => removeBodyWeight(entry.id)}
            accessibilityLabel={`Borrar el peso del ${entry.date}`}
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center active:opacity-60"
          >
            <Text className="text-xl text-danger">×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
