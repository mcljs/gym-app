import { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import palette from '@/constants/palette.json';
import { formatShortDate, parseDateKey } from '@/lib/dates';

export interface ChartPoint {
  /** Fecha 'YYYY-MM-DD'. El eje X es proporcional al tiempo, así que las pausas se ven. */
  date: string;
  value: number;
  /** Punto destacado (p. ej. un PR): se dibuja más grande. */
  highlight?: boolean;
}

interface LineChartProps {
  points: readonly ChartPoint[];
  /** Unidad para la etiqueta del punto seleccionado (kg, reps…). */
  unit: string;
  height?: number;
  /** Resumen para lectores de pantalla; la tabla de datos debe mostrarse junto a la gráfica. */
  accessibilityLabel: string;
}

const PAD = { left: 44, right: 14, top: 26, bottom: 24 };
const LINE_WIDTH = 2;
const RING = 2; // aro del color de la superficie que separa los marcadores de la línea
const HIT = 36; // zona táctil de cada punto: mayor que el marcador

const formatValue = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** Límites y marcas "redondas" del eje Y (3 divisiones aprox.). */
function niceScale(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  const span = max - min || Math.max(1, Math.abs(max) * 0.1);
  const raw = span / 3;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude);
  const lo = Math.floor(min / step) * step;
  const hi = Math.max(Math.ceil(max / step) * step, lo + step);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(Number(t.toFixed(4)));
  return { lo, hi, ticks };
}

/**
 * Gráfica de línea de UNA serie (sin leyenda: el título de la tarjeta la nombra). Sin
 * librerías: usa vistas posicionadas, así funciona igual en iOS y web sin recompilar el build.
 * Tocar un punto muestra su fecha y valor.
 */
export function LineChart({ points, unit, height = 180, accessibilityLabel }: LineChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  if (points.length === 0) return null;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;

  const values = points.map((p) => p.value);
  const { lo, hi, ticks } = niceScale(Math.min(...values), Math.max(...values));
  const times = points.map((p) => parseDateKey(p.date).getTime());
  const t0 = times[0];
  const t1 = times[times.length - 1];

  const xOf = (i: number) => PAD.left + (t1 === t0 ? plotW / 2 : ((times[i] - t0) / (t1 - t0)) * plotW);
  const yOf = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;

  // Etiquetas directas solo en el punto máximo y en el último (nunca un número en cada punto).
  const maxIndex = values.indexOf(Math.max(...values));
  const labelled = new Set([maxIndex, points.length - 1]);

  const summary = selected !== null ? points[selected] : null;

  return (
    <View onLayout={onLayout} style={{ height }} accessibilityLabel={accessibilityLabel} accessible>
      {width > 0 && (
        <>
          {/* Cuadrícula horizontal recesiva + etiquetas del eje Y */}
          {ticks.map((tick) => (
            <View key={tick} pointerEvents="none">
              <View
                style={{
                  position: 'absolute',
                  left: PAD.left,
                  width: plotW,
                  top: yOf(tick),
                  height: 1,
                  backgroundColor: palette.line,
                }}
              />
              <Text
                style={{ position: 'absolute', left: 0, width: PAD.left - 8, top: yOf(tick) - 8, textAlign: 'right' }}
                className="text-[11px] text-muted">
                {formatValue(tick)}
              </Text>
            </View>
          ))}

          {/* Etiquetas del eje X: primera y última fecha */}
          <Text style={{ position: 'absolute', left: PAD.left, top: height - PAD.bottom + 6 }} className="text-[11px] text-muted">
            {formatShortDate(points[0].date)}
          </Text>
          {points.length > 1 && (
            <Text
              style={{ position: 'absolute', right: PAD.right, top: height - PAD.bottom + 6, textAlign: 'right' }}
              className="text-[11px] text-muted">
              {formatShortDate(points[points.length - 1].date)}
            </Text>
          )}

          {/* Línea: un segmento por par de puntos */}
          {points.slice(1).map((_, i) => {
            const x0 = xOf(i);
            const y0 = yOf(points[i].value);
            const x1 = xOf(i + 1);
            const y1 = yOf(points[i + 1].value);
            const length = Math.hypot(x1 - x0, y1 - y0);
            return (
              <View
                key={`seg-${i}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (x0 + x1) / 2 - length / 2,
                  top: (y0 + y1) / 2 - LINE_WIDTH / 2,
                  width: length,
                  height: LINE_WIDTH,
                  borderRadius: LINE_WIDTH / 2,
                  backgroundColor: palette.accent,
                  transform: [{ rotate: `${Math.atan2(y1 - y0, x1 - x0)}rad` }],
                }}
              />
            );
          })}

          {/* Marcadores: los PR son más grandes; el aro de la superficie los separa de la línea */}
          {points.map((point, i) => {
            const size = (point.highlight ? 14 : 10) + (selected === i ? 4 : 0);
            return (
              <Pressable
                key={`pt-${point.date}`}
                onPress={() => setSelected(selected === i ? null : i)}
                accessibilityLabel={`${formatShortDate(point.date)}: ${formatValue(point.value)} ${unit}${point.highlight ? ', nuevo PR' : ''}`}
                style={{
                  position: 'absolute',
                  left: xOf(i) - HIT / 2,
                  top: yOf(point.value) - HIT / 2,
                  width: HIT,
                  height: HIT,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: palette.accent,
                    borderWidth: RING,
                    borderColor: palette.surface,
                  }}
                />
              </Pressable>
            );
          })}

          {/* Etiquetas directas del máximo y del último punto */}
          {[...labelled].map((i) => (
            <Text
              key={`lbl-${i}`}
              pointerEvents="none"
              className="text-xs font-semibold text-ink"
              style={{
                position: 'absolute',
                width: 60,
                textAlign: 'center',
                left: Math.min(Math.max(xOf(i) - 30, 0), width - 60),
                top: yOf(points[i].value) - 26,
              }}>
              {formatValue(points[i].value)}
            </Text>
          ))}

          {/* Tooltip del punto tocado */}
          {summary && selected !== null && (
            <View
              pointerEvents="none"
              className="rounded-lg border border-line bg-elevated px-2.5 py-1.5"
              style={{
                position: 'absolute',
                left: Math.min(Math.max(xOf(selected) - 62, 0), width - 124),
                top: Math.max(yOf(summary.value) - 62, 0),
                width: 124,
              }}>
              <Text className="text-center text-xs text-muted">{formatShortDate(summary.date)}</Text>
              <Text className="text-center text-sm font-semibold text-ink">
                {formatValue(summary.value)} {unit}
                {summary.highlight ? ' · PR' : ''}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}
