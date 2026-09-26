import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { ExerciseThumb } from '@/components/ExerciseThumb';
import { LineChart } from '@/components/LineChart';
import { Notice } from '@/components/Notice';
import { getExercise, muscleLabel } from '@/data/catalog';
import { useLifts } from '@/hooks/useLifts';
import { formatShortDate } from '@/lib/dates';
import type { LiftSummary } from '@/progress/types';

const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Detalle de un ejercicio: 1RM real vs. estimado, PRs de repeticiones, gráfica y tabla por sesión. */
export default function LiftScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const lift = useLifts().find((l) => l.exerciseSlug === slug);
  const info = getExercise(slug);
  const name = info?.name ?? slug;

  if (!lift) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Stack.Screen options={{ title: name }} />
        <Text className="text-center text-muted">Todavía no hay sesiones de fuerza registradas de este ejercicio.</Text>
      </View>
    );
  }

  const weighted = lift.kind === 'weighted';
  // La primera sesión es la línea base: no se marca como PR (no hay nada que superar todavía).
  const points = lift.history.map((h, i) => ({
    date: h.date,
    value: weighted ? (h.e1rm as number) : h.topSet.reps,
    highlight: h.isPr && i > 0,
  }));
  const unit = weighted ? 'kg' : 'reps';

  return (
    <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
      <Stack.Screen options={{ title: name }} />

      <View className="flex-row items-center gap-3">
        <ExerciseThumb slug={lift.exerciseSlug} size={64} />
        <View className="flex-1 gap-0.5">
          <Text className="text-lg font-bold text-ink">{name}</Text>
          {info && <Text className="text-xs text-muted">{muscleLabel(info.muscleGroup)}</Text>}
          <Text className="text-xs text-muted">
            {lift.sessions} {lift.sessions === 1 ? 'sesión' : 'sesiones'} de fuerza · desde {formatShortDate(lift.firstDate)}
          </Text>
        </View>
      </View>

      {lift.stale && (
        <Notice
          tone="warn"
          title={`Estancado: ${lift.weeksSincePr} semanas sin superar tu mejor marca`}
          body={
            weighted
              ? `Para romper la meseta, supera ${kg(lift.toBeat.weightKg)} kg × ${lift.toBeat.reps}. Prueba a cambiar la carga, el tempo o la variante.`
              : `Para romper la meseta, supera ${lift.toBeat.reps} repeticiones.`
          }
        />
      )}

      <View className="gap-2 rounded-2xl border border-line bg-surface p-4">
        <Text className="text-base font-semibold text-ink">Mejor marca</Text>
        {weighted ? <WeightedRecords lift={lift} /> : <BodyweightRecords lift={lift} />}
        {lift.sessions === 1 ? (
          <Row label="Línea base" value={formatShortDate(lift.firstDate)} hint="primera sesión: aún no hay nada que superar" />
        ) : (
          <Row
            label="Último PR"
            value={formatShortDate(lift.lastPrDate)}
            hint={lift.weeksSincePr === 0 ? 'esta semana' : `hace ${lift.weeksSincePr} semanas`}
          />
        )}
      </View>

      {lift.repPrs.length > 0 && (
        <View className="gap-2 rounded-2xl border border-line bg-surface p-4">
          <Text className="text-base font-semibold text-ink">PRs de repeticiones (últimos 28 días)</Text>
          {lift.repPrs.map((pr) => (
            <View key={`${pr.date}-${pr.weightKg}`} className="flex-row justify-between gap-3">
              <Text className="flex-1 text-sm text-ink">
                ▲ {pr.reps} reps con {kg(pr.weightKg)} kg
                <Text className="text-muted"> (antes {pr.previousBest})</Text>
              </Text>
              <Text className="text-sm text-muted">{formatShortDate(pr.date)}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="gap-2 rounded-2xl border border-line bg-surface p-4">
        <Text className="text-base font-semibold text-ink">
          {weighted ? '1RM estimado por sesión' : 'Mejor serie por sesión (reps)'}
        </Text>
        {points.length >= 2 ? (
          <>
            <LineChart
              points={points}
              unit={unit}
              accessibilityLabel={`${weighted ? '1RM estimado' : 'Repeticiones'} de ${name} en ${points.length} sesiones: de ${points[0].value} a ${points[points.length - 1].value} ${unit}`}
            />
            <Text className="text-xs text-muted">Punto grande = nuevo PR (▲ en la tabla). Toca un punto para ver su valor.</Text>
          </>
        ) : (
          <Text className="text-sm text-muted">La gráfica aparece a partir de la segunda sesión.</Text>
        )}
      </View>

      {/* Vista en tabla de los mismos datos de la gráfica */}
      <View className="gap-2 rounded-2xl border border-line bg-surface p-4">
        <Text className="text-base font-semibold text-ink">Historial</Text>
        <View className="flex-row gap-2">
          <Text className="w-14 text-xs text-muted">Fecha</Text>
          <Text className="flex-1 text-xs text-muted">Mejor serie</Text>
          <Text className="w-20 text-right text-xs text-muted">{weighted ? '1RM est.' : 'Reps'}</Text>
        </View>
        {lift.history.map((h, i) => ({ h, isPr: h.isPr && i > 0 })).reverse().slice(0, 15).map(({ h, isPr }) => (
          <View key={h.date} className="flex-row items-center gap-2">
            <Text className="w-14 text-sm text-muted">{formatShortDate(h.date)}</Text>
            <Text className="flex-1 text-sm text-ink">
              {weighted ? `${kg(h.topSet.weightKg)} kg × ${h.topSet.reps}` : `${h.topSet.reps} reps`}
            </Text>
            <Text className="w-20 text-right text-sm font-medium text-ink">
              {weighted ? kg(h.e1rm as number) : h.topSet.reps}
              {isPr ? ' ▲' : ''}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <Text className="rounded bg-elevated px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink">{label}</Text>
  );
}

function Row({ label, value, hint, tag }: { label: string; value: string; hint?: string; tag?: string }) {
  return (
    <View className="gap-0.5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-muted">{label}</Text>
          {tag && <Tag label={tag} />}
        </View>
        <Text className="flex-1 text-right text-sm font-semibold text-ink">{value}</Text>
      </View>
      {hint && <Text className="text-right text-xs text-muted">{hint}</Text>}
    </View>
  );
}

/** El máximo real (una repetición) y el estimado se muestran siempre por separado y con su etiqueta. */
function WeightedRecords({ lift }: { lift: LiftSummary }) {
  return (
    <>
      {lift.trueOneRm ? (
        <Row label="1RM" tag="REAL" value={`${kg(lift.trueOneRm.weightKg)} kg`} hint={formatShortDate(lift.trueOneRm.date)} />
      ) : (
        <Row label="1RM" tag="REAL" value="sin single registrado" hint="Registra una serie de 1 repetición para tener un máximo real" />
      )}
      {lift.estimated ? (
        <Row
          label="1RM"
          tag="ESTIMADO"
          value={`${kg(lift.estimated.e1rm)} kg`}
          hint={`de ${kg(lift.estimated.set.weightKg)} kg × ${lift.estimated.set.reps} (Epley) · ${formatShortDate(lift.estimated.date)}`}
        />
      ) : (
        <Row label="1RM" tag="ESTIMADO" value="—" hint="Hace falta una serie de 2+ repeticiones" />
      )}
      {lift.heaviest && (
        <Row
          label="Serie más pesada"
          value={`${kg(lift.heaviest.weightKg)} kg × ${lift.heaviest.reps}`}
          hint={formatShortDate(lift.heaviest.date)}
        />
      )}
    </>
  );
}

function BodyweightRecords({ lift }: { lift: LiftSummary }) {
  return <Row label="Más repeticiones" value={`${lift.best.value} reps`} hint={formatShortDate(lift.best.date)} />;
}
