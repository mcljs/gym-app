import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { ExerciseThumb } from '@/components/ExerciseThumb';
import palette from '@/constants/palette.json';
import { CATALOG_SEED, muscleLabel, searchCatalog } from '@/data/catalog';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import type { Weekday } from '@/types';

/**
 * Selector de ejercicios (modal). Se usa en dos contextos:
 *  - mode=template&day=N  → agrega a la PLANTILLA de ese día.
 *  - mode=session&sessionId=ID → agrega solo a la SESIÓN de hoy (la plantilla no cambia).
 * Se queda abierto para poder agregar varios seguidos; "Listo" lo cierra.
 */
export default function ExercisePickerScreen() {
  const router = useRouter();
  const { mode, day, sessionId } = useLocalSearchParams<{
    mode?: string;
    day?: string;
    sessionId?: string;
  }>();
  const [query, setQuery] = useState('');

  const isTemplate = mode === 'template';
  const weekday = Number(day) as Weekday;

  // Ejercicios que ya están en el destino, para no agregarlos dos veces sin querer.
  const existingSlugs = useWorkoutStore((s) => {
    if (isTemplate) return s.template[weekday]?.targets;
    return s.sessions.find((x) => x.id === sessionId)?.exercises;
  });
  const addTarget = useWorkoutStore((s) => s.addTarget);
  const addSessionExercise = useWorkoutStore((s) => s.addSessionExercise);

  const added = useMemo(
    () => new Set((existingSlugs ?? []).map((e) => e.exerciseSlug)),
    [existingSlugs],
  );
  const results = useMemo(() => searchCatalog(query), [query]);
  const isSearching = query.trim().length > 0;

  function handlePick(slug: string) {
    if (isTemplate) addTarget(weekday, slug);
    else if (sessionId) addSessionExercise(sessionId, slug);
  }

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen
        options={{
          headerRight: () => (
            // En web el header no da margen lateral al botón derecho; en iOS ya lo da el sistema.
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              style={{ paddingRight: Platform.OS === 'web' ? 16 : 0 }}>
              <Text className="text-base font-semibold text-accent">Listo</Text>
            </Pressable>
          ),
        }}
      />

      <View className="gap-1 px-4 pb-2 pt-3">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar en inglés: curl, squat, row…"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          className="h-12 rounded-xl border border-line bg-surface px-4 text-base text-ink"
        />
        <Text className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {isSearching ? `${results.length} resultados` : `Sugeridos (${CATALOG_SEED.length})`}
        </Text>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.slug}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="gap-2 px-4 pb-12 pt-1"
        ListEmptyComponent={
          <Text className="pt-8 text-center text-sm text-muted">
            Sin resultados. Los nombres del catálogo están en inglés.
          </Text>
        }
        renderItem={({ item }) => {
          const isAdded = added.has(item.slug);
          return (
            <Pressable
              onPress={() => handlePick(item.slug)}
              disabled={isAdded}
              accessibilityRole="button"
              className={`flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3 active:opacity-70 ${
                isAdded ? 'opacity-50' : ''
              }`}>
              <ExerciseThumb slug={item.slug} size={48} />
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold text-ink" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="text-xs text-muted">
                  {muscleLabel(item.muscleGroup)} · {item.equipment}
                </Text>
              </View>
              <Text className={`text-base font-bold ${isAdded ? 'text-muted' : 'text-accent'}`}>
                {isAdded ? '✓ Agregado' : '+'}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
