import { Image } from 'expo-image';

import { getExerciseImageUrl } from '@/data/catalog';
import palette from '@/constants/palette.json';

interface ExerciseThumbProps {
  slug: string;
  size?: number;
}

/**
 * Ilustración del ejercicio (frame 1 del paquete). Las imágenes son remotas (CDN de jsDelivr)
 * y expo-image las cachea en disco, así que solo hace falta conexión la primera vez que se ve
 * cada ejercicio. Si el slug no existe, queda el recuadro vacío.
 */
export function ExerciseThumb({ slug, size = 64 }: ExerciseThumbProps) {
  const uri = getExerciseImageUrl(slug);
  return (
    <Image
      source={uri ? { uri } : undefined}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={150}
      recyclingKey={slug}
      style={{ width: size, height: size, borderRadius: 12, backgroundColor: palette.elevated }}
    />
  );
}
