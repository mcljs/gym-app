import { Text, View } from 'react-native';

import type { DayType } from '@/types';

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  fuerza: 'Fuerza',
  funcional: 'Funcional',
  descanso: 'Descanso',
};

// Clases completas (no construidas dinámicamente) para que Tailwind las detecte al compilar.
const STYLES: Record<DayType, { box: string; text: string }> = {
  fuerza: { box: 'bg-fuerza/15', text: 'text-fuerza' },
  funcional: { box: 'bg-funcional/15', text: 'text-funcional' },
  descanso: { box: 'bg-descanso/15', text: 'text-descanso' },
};

/** Etiqueta de color para el tipo de día: fuerza / funcional / descanso. */
export function DayTypeChip({ dayType }: { dayType: DayType }) {
  const style = STYLES[dayType];
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${style.box}`}>
      <Text className={`text-xs font-semibold ${style.text}`}>{DAY_TYPE_LABELS[dayType]}</Text>
    </View>
  );
}
