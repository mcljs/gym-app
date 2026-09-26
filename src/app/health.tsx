import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import palette from '@/constants/palette.json';
import {
  getHealthStatus,
  readHealthSnapshot,
  requestPermissions,
} from '@/health/healthkit';
import type {
  HealthSnapshot,
  HeartRateSample,
  Metric,
  SleepNight,
  WorkoutSummary,
} from '@/health/types';
import { formatDateTime, formatMinutes } from '@/lib/dates';

/**
 * Pantalla de VERIFICACIÓN de Apple Health.
 *
 * Solo sirve para confirmar que la lectura de HealthKit funciona: muestra los datos en crudo,
 * sin interpretarlos. Todavía no hay Fit Score ni análisis.
 */

/** Fases de la pantalla. `ready` = permisos ya solicitados (no implica que se hayan concedido). */
type ScreenState =
  | { phase: 'checking' }
  | { phase: 'unsupported' | 'unavailable' }
  | { phase: 'needs-permission'; error?: string }
  | { phase: 'ready'; snapshot: HealthSnapshot | null; loading: boolean };

/** Lee todas las métricas y actualiza el estado. Fuera del componente para no capturar estado viejo. */
async function refreshInto(setState: Dispatch<SetStateAction<ScreenState>>) {
  setState((prev) => ({
    phase: 'ready',
    snapshot: prev.phase === 'ready' ? prev.snapshot : null,
    loading: true,
  }));
  const snapshot = await readHealthSnapshot();
  setState({ phase: 'ready', snapshot, loading: false });
}

export default function HealthScreen() {
  const [state, setState] = useState<ScreenState>({ phase: 'checking' });

  // Al abrir: si los permisos ya se pidieron antes, se leen los datos directamente.
  useEffect(() => {
    (async () => {
      const status = await getHealthStatus();
      if (status === 'ready') await refreshInto(setState);
      else setState({ phase: status });
    })();
  }, []);

  async function handleConnect() {
    const result = await requestPermissions();
    if (result.status === 'requested') await refreshInto(setState);
    else if (result.status === 'error') setState({ phase: 'needs-permission', error: result.message });
    else setState({ phase: result.status });
  }

  return (
    <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
      <Text className="text-sm text-muted">
        Verificación de la lectura de Apple Health. Los datos se muestran tal cual llegan, sin analizar.
      </Text>

      {state.phase === 'checking' && (
        <View className="items-center py-10">
          <ActivityIndicator color={palette.accent} />
        </View>
      )}

      {state.phase === 'unsupported' && (
        <Notice
          tone="warn"
          title="Apple Health no está disponible aquí"
          body="HealthKit solo funciona en el development build de iOS, no en Expo Go, web ni Android. Instala el build en tu iPhone (mira el README) y abre esta pantalla de nuevo."
        />
      )}

      {state.phase === 'unavailable' && (
        <Notice
          tone="warn"
          title="HealthKit no está disponible"
          body="Este dispositivo no expone Apple Health (por ejemplo, un iPad) o el módulo no pudo iniciar. Prueba en un iPhone con el development build."
        />
      )}

      {state.phase === 'needs-permission' && (
        <View className="gap-3">
          <Notice
            tone="info"
            title="Sin permiso todavía"
            body="La app pedirá permiso de solo lectura para frecuencia cardíaca, FC en reposo, sueño, calorías activas, pasos y entrenamientos. No escribe nada en Apple Health."
          />
          {state.error && <Notice tone="error" title="No se pudo pedir el permiso" body={state.error} />}
          <Button label="Conectar Apple Health" onPress={handleConnect} />
        </View>
      )}

      {state.phase === 'ready' && (
        <ReadyView state={state} onRefresh={() => refreshInto(setState)} />
      )}
    </ScrollView>
  );
}

// ── Vista con permisos solicitados ───────────────────────────────────────────

function ReadyView({
  state,
  onRefresh,
}: {
  state: Extract<ScreenState, { phase: 'ready' }>;
  onRefresh: () => void;
}) {
  const { snapshot, loading } = state;

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-xs text-muted">
          {loading
            ? 'Leyendo Apple Health…'
            : snapshot
              ? `Última lectura: ${formatDateTime(snapshot.fetchedAt)}`
              : ''}
        </Text>
        <Button
          label={loading ? 'Leyendo…' : '↻ Refrescar'}
          variant="secondary"
          disabled={loading}
          onPress={onRefresh}
          className="px-4 py-2.5"
        />
      </View>

      {snapshot && isEverythingEmpty(snapshot) && (
        <Notice
          tone="info"
          title="Sin datos"
          body="No llegó ningún dato. Puede ser que aún no haya nada en Apple Health (abre la app Google Health para que sincronice el Fitbit) o que hayas negado el permiso: iOS no permite a la app saber cuál de las dos es. Revisa en la app Salud ▸ tu foto ▸ Apps ▸ gym-app que las categorías estén activadas."
        />
      )}

      <HeartRateCard metric={snapshot?.heartRate} />
      <RestingHeartRateCard metric={snapshot?.restingHeartRate} />
      <SleepCard metric={snapshot?.sleep} />
      <SumCard
        title="Calorías activas · hoy"
        metric={snapshot?.activeEnergyToday}
        format={(total) => `${Math.round(total)} kcal`}
      />
      <SumCard
        title="Pasos · hoy"
        metric={snapshot?.stepsToday}
        format={(total) => `${Math.round(total).toLocaleString('es')} pasos`}
      />
      <WorkoutCard metric={snapshot?.lastWorkout} />
    </View>
  );
}

/** `true` si todas las lecturas terminaron bien pero no trajeron nada. */
function isEverythingEmpty(s: HealthSnapshot): boolean {
  return (
    s.heartRate.ok && s.heartRate.data.samples.length === 0 &&
    s.restingHeartRate.ok && s.restingHeartRate.data.samples.length === 0 &&
    s.sleep.ok && s.sleep.data === null &&
    s.activeEnergyToday.ok && s.activeEnergyToday.data.total === 0 &&
    s.stepsToday.ok && s.stepsToday.data.total === 0 &&
    s.lastWorkout.ok && s.lastWorkout.data === null
  );
}

// ── Tarjetas por métrica ─────────────────────────────────────────────────────

function HeartRateCard({ metric }: { metric: HealthSnapshot['heartRate'] | undefined }) {
  return (
    <MetricCard
      title="Frecuencia cardíaca · últimas 24 h"
      metric={metric}
      isEmpty={(d) => d.samples.length === 0}>
      {(d) => (
        <>
          <Row label="Promedio" value={d.averageBpm !== null ? `${Math.round(d.averageBpm)} bpm` : '—'} />
          <Row
            label="Mín / Máx"
            value={d.minBpm !== null && d.maxBpm !== null ? `${Math.round(d.minBpm)} / ${Math.round(d.maxBpm)} bpm` : '—'}
          />
          <Text className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Últimas {Math.min(d.samples.length, 8)} muestras
          </Text>
          {d.samples.slice(0, 8).map((sample, i) => (
            <SampleLine key={`${sample.start.toISOString()}-${i}`} sample={sample} />
          ))}
        </>
      )}
    </MetricCard>
  );
}

function RestingHeartRateCard({ metric }: { metric: HealthSnapshot['restingHeartRate'] | undefined }) {
  return (
    <MetricCard
      title="FC en reposo · últimos 2 días"
      metric={metric}
      isEmpty={(d) => d.samples.length === 0}>
      {(d) => (
        <>
          {d.samples.slice(0, 5).map((sample, i) => (
            <SampleLine key={`${sample.start.toISOString()}-${i}`} sample={sample} />
          ))}
        </>
      )}
    </MetricCard>
  );
}

function SleepCard({ metric }: { metric: HealthSnapshot['sleep'] | undefined }) {
  return (
    <MetricCard title="Sueño de anoche" metric={metric} isEmpty={(d) => d === null}>
      {(night) => night && <SleepDetails night={night} />}
    </MetricCard>
  );
}

function SleepDetails({ night }: { night: SleepNight }) {
  const { minutesByStage: stages } = night;
  return (
    <>
      <Row label="Dormido" value={formatMinutes(night.minutesAsleep)} />
      <Row label="En cama" value={formatMinutes(night.minutesInBed)} />
      <Row label="Despierto" value={formatMinutes(night.minutesAwake)} />
      <Row label="Horario" value={`${formatDateTime(night.start)} → ${formatDateTime(night.end)}`} />
      {night.hasStages ? (
        <>
          <Row label="Ligero (core)" value={formatMinutes(stages.core)} />
          <Row label="Profundo" value={formatMinutes(stages.deep)} />
          <Row label="REM" value={formatMinutes(stages.rem)} />
        </>
      ) : (
        <Row label="Etapas" value="la fuente no las reporta" />
      )}
      <Row
        label="Fuente"
        value={night.otherSources.length > 0 ? `${night.primarySource} (+ ${night.otherSources.join(', ')})` : night.primarySource}
      />
      <Row label="Segmentos" value={String(night.segments.length)} />
    </>
  );
}

function SumCard({
  title,
  metric,
  format,
}: {
  title: string;
  metric: HealthSnapshot['activeEnergyToday'] | undefined;
  format: (total: number) => string;
}) {
  return (
    <MetricCard title={title} metric={metric} isEmpty={(d) => d.total === 0}>
      {(d) => (
        <>
          <Text className="text-2xl font-bold text-ink">{format(d.total)}</Text>
          <Text className="text-xs text-muted">Fuente: {d.sources.join(', ') || '—'}</Text>
        </>
      )}
    </MetricCard>
  );
}

function WorkoutCard({ metric }: { metric: HealthSnapshot['lastWorkout'] | undefined }) {
  return (
    <MetricCard title="Último entrenamiento · últimos 14 días" metric={metric} isEmpty={(d) => d === null}>
      {(workout) => workout && <WorkoutDetails workout={workout} />}
    </MetricCard>
  );
}

function WorkoutDetails({ workout }: { workout: WorkoutSummary }) {
  return (
    <>
      <Text className="text-lg font-bold text-ink">{workout.activityType}</Text>
      <Row label="Inicio" value={formatDateTime(workout.start)} />
      <Row label="Fin" value={formatDateTime(workout.end)} />
      <Row label="Duración" value={formatMinutes(workout.durationMinutes)} />
      <Row label="Energía" value={workout.activeEnergyKcal !== null ? `${Math.round(workout.activeEnergyKcal)} kcal` : '—'} />
      <Row label="Distancia" value={workout.distanceMeters !== null ? `${Math.round(workout.distanceMeters)} m` : '—'} />
      <Row
        label="FC media / máx"
        value={
          workout.avgHeartRateBpm !== null && workout.maxHeartRateBpm !== null
            ? `${Math.round(workout.avgHeartRateBpm)} / ${Math.round(workout.maxHeartRateBpm)} bpm`
            : 'sin datos de FC'
        }
      />
      <Row label="Fuente" value={workout.device ? `${workout.source} · ${workout.device}` : workout.source} />
    </>
  );
}

// ── Piezas de UI ─────────────────────────────────────────────────────────────

/**
 * Tarjeta de una métrica con sus 4 estados: cargando (aún no hay lectura), error de esa
 * lectura, sin datos y con datos.
 */
function MetricCard<T>({
  title,
  metric,
  isEmpty,
  children,
}: {
  title: string;
  metric: Metric<T> | undefined;
  isEmpty: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  let body: ReactNode;
  if (!metric) {
    body = <Text className="text-sm text-muted">Cargando…</Text>;
  } else if (!metric.ok) {
    body = <Text className="text-sm text-danger">Error al leer: {metric.error}</Text>;
  } else if (isEmpty(metric.data)) {
    body = <Text className="text-sm text-muted">Sin datos en este rango.</Text>;
  } else {
    body = children(metric.data);
  }

  return (
    <View className="gap-1.5 rounded-2xl border border-line bg-surface p-4">
      <Text className="pb-1 text-sm font-semibold text-ink">{title}</Text>
      {body}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-ink">{value}</Text>
    </View>
  );
}

/** Una muestra de FC: valor, momento y fuente/dispositivo. */
function SampleLine({ sample }: { sample: HeartRateSample }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text className="text-sm font-semibold text-ink">{Math.round(sample.bpm)} bpm</Text>
      <Text className="flex-1 text-right text-xs text-muted" numberOfLines={1}>
        {formatDateTime(sample.start)} · {sample.device ? `${sample.source} · ${sample.device}` : sample.source}
      </Text>
    </View>
  );
}
