import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getIsoWeekday, toDateKey } from '@/lib/dates';

/**
 * Fecha y día de la semana de "hoy". Se refresca al volver a la app desde segundo plano, para
 * que si la dejé abierta de un día para otro no siga mostrando el día anterior.
 */
export function useToday() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => subscription.remove();
  }, []);

  return { now, dateKey: toDateKey(now), weekday: getIsoWeekday(now) };
}
