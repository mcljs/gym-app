import '../global.css';

import { Stack } from 'expo-router';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import palette from '@/constants/palette.json';
import { useStoreHydrated } from '@/store/useWorkoutStore';

// La splash se mantiene hasta que el store haya leído AsyncStorage (evita un parpadeo con el seed).
SplashScreen.preventAutoHideAsync();

// App solo en tema oscuro: el tema de navegación toma los mismos colores que Tailwind.
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: palette.bg,
    card: palette.bg,
    border: palette.line,
    text: palette.ink,
    primary: palette.accent,
  },
};

export default function RootLayout() {
  const hydrated = useStoreHydrated();

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.bg },
          headerTintColor: palette.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.bg },
        }}>
        {/* Pantalla principal: tiene su propio encabezado dentro de la vista. */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="routine/index" options={{ title: 'Mi rutina', headerBackTitle: 'Hoy' }} />
        <Stack.Screen name="routine/[day]" options={{ title: '', headerBackTitle: 'Rutina' }} />
        <Stack.Screen name="health" options={{ title: 'Apple Health', headerBackTitle: 'Hoy' }} />
        <Stack.Screen name="score" options={{ title: 'Fit Score', headerBackTitle: 'Hoy' }} />
        <Stack.Screen name="progress" options={{ title: 'Progreso', headerBackTitle: 'Hoy' }} />
        <Stack.Screen name="lift/[slug]" options={{ title: '', headerBackTitle: 'Progreso' }} />
        <Stack.Screen
          name="exercise-picker"
          options={{ title: 'Agregar ejercicio', presentation: 'modal' }}
        />
      </Stack>
      {/* Tapa la app hasta hidratar el store (en web no hay splash nativa). */}
      {!hydrated && <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]} />}
    </ThemeProvider>
  );
}
