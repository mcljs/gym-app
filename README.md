# gym-app

App personal de gym (un solo usuario): log de rutina con plantilla editable y, desde la Fase 2,
lectura de datos del Fitbit vía Apple Health.

Expo SDK 55 · Expo Router (`src/app`) · TypeScript · Zustand + AsyncStorage · NativeWind 4 + Tailwind 3

## Dos formas de correr la app

| | Qué funciona | Cómo |
|---|---|---|
| **Web / Expo Go** | Log de rutina (Fase 1). La pantalla Salud solo avisa que no hay HealthKit. | `npx expo start` |
| **Development build en iPhone** | Todo, incluida la lectura de Apple Health. | Pasos de abajo |

HealthKit no existe en Expo Go ni en web: necesita un build nativo propio.

## Development build en tu iPhone

Ruta de datos: Fitbit Air → app Google Health → Apple Health → esta app (solo lectura local).
Sin API de Fitbit, sin backend, sin OAuth.

### Una sola vez, en tu Mac

1. **Xcode** (SDK 55 pide Xcode 26.2 o superior; compatible con Xcode 26.3) instalado y seleccionado como herramienta activa:

   ```bash
   xcode-select -p
   # debe imprimir /Applications/Xcode.app/Contents/Developer
   # si imprime /Library/Developer/CommandLineTools, corrige con:
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```

2. **CocoaPods** (Expo lo necesita para instalar las librerías nativas):

   ```bash
   pod --version || brew install cocoapods
   ```

3. **Tu Apple ID en Xcode**: Xcode ▸ Settings ▸ Accounts ▸ `+` ▸ Apple ID. Aparecerá un
   *Personal Team* (cuenta gratuita).

4. **Modo desarrollador en el iPhone**: Ajustes ▸ Privacidad y seguridad ▸ Modo de desarrollador ▸
   activar (pide reiniciar). Conecta el iPhone por cable y toca **Confiar** en el aviso.

### Compilar e instalar

```bash
npm install
npx expo run:ios --device
```

`run:ios` genera la carpeta `ios/` si no existe (`expo prebuild`), instala los pods, compila e
instala en el iPhone. Elige tu iPhone en la lista. La primera vez tarda varios minutos.

**Firma con Apple ID gratis** — si la compilación falla con un error de firma (*Signing*):

1. Abre `ios/gymapp.xcworkspace` en Xcode (el `.xcworkspace`, no el `.xcodeproj`).
2. Selecciona el proyecto `gymapp` ▸ target `gymapp` ▸ pestaña **Signing & Capabilities**.
3. Marca *Automatically manage signing* y en **Team** elige tu *Personal Team*.
4. Debe aparecer la capability **HealthKit** (viene del config plugin; no la agregues a mano).
5. Si Xcode dice que el *Bundle Identifier* no está disponible, cámbialo en `app.json`
   (`expo.ios.bundleIdentifier`, hoy `com.mcljs.gymapp`) por otro único, p. ej.
   `com.tunombre.gymapp`, y vuelve a correr `npx expo prebuild --platform ios --clean`.
6. Vuelve a correr `npx expo run:ios --device`.

**Primer arranque en el iPhone:** si iOS dice *Desarrollador no confiable*: Ajustes ▸ General ▸
VPN y gestión de dispositivos ▸ tu Apple ID ▸ **Confiar**.

### Día a día

```bash
npx expo start --dev-client
```

Abre la app **gym-app** en el iPhone (no Expo Go); se conecta al servidor de Metro por la misma
red Wi-Fi. Los cambios de JavaScript/TypeScript se ven al instante, **sin recompilar**. Solo hay
que volver a correr `npx expo run:ios --device` cuando cambien dependencias nativas o `app.json`.

### Cada 7 días: reinstalar

Con Apple ID gratis, el build **caduca a los 7 días** y la app deja de abrir. Para renovarla,
conecta el iPhone y corre otra vez:

```bash
npx expo run:ios --device
```

> **No borres la app del iPhone** para renovarla: tu rutina y tus sesiones viven en el
> almacenamiento local de la app y se perderían. Reinstalar encima (con el mismo bundle id)
> las conserva.

Límites de la cuenta gratuita: máximo 3 apps de desarrollo por dispositivo y el bundle id debe
ser único.

## Pantalla de verificación de Apple Health

Desde **Hoy** ▸ botón **♥ Salud**. Sirve solo para confirmar que la lectura funciona (todavía no
hay Fit Score). Si todo salió bien:

1. Primero ves **"Sin permiso todavía"** y el botón **Conectar Apple Health**.
2. Al tocarlo, iOS muestra su hoja de permisos con las 6 categorías (frecuencia cardíaca, FC en
   reposo, sueño, calorías activas, pasos, entrenamientos). Activa todas y pulsa **Permitir**.
3. Aparecen tarjetas con datos en crudo, cada una con su fuente (p. ej. la app de Google Health):
   - **FC últimas 24 h**: promedio, mín/máx y las últimas 8 muestras.
   - **FC en reposo**: 1 valor al día aprox.
   - **Sueño de anoche**: dormido / en cama / despierto, y etapas si el Fitbit las reporta.
   - **Calorías activas** y **pasos** de hoy.
   - **Último entrenamiento** (últimos 14 días) con duración, energía y FC media/máx.
4. **↻ Refrescar** vuelve a leer.

### Si sale "Sin datos"

iOS **no permite a la app saber si negaste el permiso de lectura**: se ve igual que no tener
datos. Revisa en este orden:

- ¿Hay datos en la propia app **Salud** de iOS? Si no, el problema está antes de esta app:
  abre **Google Health** para que sincronice el Fitbit con Apple Health y confirma ahí que la
  escritura a Apple Health está activada.
- En la app **Salud** ▸ tu foto ▸ **Apps** ▸ **gym-app**: las 6 categorías deben estar activas.
  (iOS solo muestra la hoja de permisos una vez; después se cambia desde ahí.)

## Estructura de la capa de salud

```
src/health/
  healthkit.ts   Único archivo que conoce la librería de HealthKit. Expone permisos y lecturas.
  types.ts       Tipos propios de la app (no dependen de la librería).
  sleep.ts       Lógica pura: arma "la noche" a partir de segmentos (probada sin iPhone).
```

Fuera de iOS (web, Expo Go, Android) las lecturas devuelven valores vacíos y la pantalla explica
por qué; la app nunca crashea por HealthKit.

## Fit Score semanal

Desde **Hoy** ▸ **◎ Score**. Cuatro señales de 0 a 100, cada una visible por separado:

| Señal | De dónde sale | Se juzga sobre todo en |
|---|---|---|
| Progresión de carga | Tu log: 1RM estimado vs. tus 4 semanas previas (AMRAP contra AMRAP si lo marcas) | Días de fuerza |
| Recuperación | Sueño + FC en reposo (Apple Health) vs. tu promedio previo | Ambos |
| Intensidad | FC media vs. tu FC máx. + kcal/min del entrenamiento (Apple Health) | Días funcionales |
| Peso corporal | Registro manual; tendencia de 4 semanas (meta: ganar masa despacio) | Ambos |

Cada señal pesa distinto según el tipo de día: el score mezcla la fila "fuerza" y la fila
"funcional" según cuántas sesiones de cada tipo hiciste esa semana. Las señales sin datos se
descartan y su peso se reparte entre las demás; con menos de 2 señales no se muestra score.

```
src/score/
  config.ts   TODOS los pesos, umbrales y curvas. Se recalibra aquí.
  engine.ts   Función pura: datos → FitScore (sin HealthKit ni store).
  types.ts    FitScore: datos planos, listos para pasarse al coach de IA (Fase 3).
```

Pruebas (usan el test runner de Node; no agregan dependencias):

```bash
npx --yes tsx --test src/score/engine.test.ts src/progress/progress.test.ts
```

Todavía no hay coach de IA: el veredicto en lenguaje natural es la siguiente etapa.

## Progreso: PRs, estancados y volumen

Desde **Hoy** ▸ **▲ Progreso**. Todo sale de tu log (solo sesiones de fuerza), sin datos nuevos:

- **Reto del día** (también en Hoy, antes de empezar): el ejercicio más estancado con el número
  concreto a superar; si no hay ninguno, te pide registrar un levantamiento base que nunca hayas
  hecho. No caduca: sigue igual hasta que lo superes.
- **Estancados:** un ejercicio sin superar su mejor marca (1RM estimado) en 8+ semanas, que sigues
  entrenando.
- **PRs por ejercicio:** 1RM **real** (serie de 1 repetición) y **estimado** (Epley) siempre por
  separado y etiquetados; PR de repeticiones (más reps con el mismo peso); gráfica del 1RM estimado
  por sesión con su tabla de datos.
- **Volumen semanal por músculo:** series duras (sets con 5+ reps) por músculo principal contra la
  banda de 10–20 por semana. Sin RPE en el log no se distinguen los calentamientos.

Los umbrales (semanas para estancarse, banda de volumen, levantamientos base, qué músculo va en
qué grupo) están en `src/progress/config.ts`.

## Compatibilidad de esta versión

Se usa Expo SDK 55 y React Native 0.83 para compilar con Xcode 26.3.
No actualizar a SDK 56/57 sin actualizar primero Xcode.

Para instalar una versión autónoma en un iPhone conectado, después de configurar
la firma en Xcode e instalar CocoaPods:

```bash
npx expo run:ios --device --configuration Release
```

La firma gratuita Personal Team caduca a los 7 días. La disponibilidad de HealthKit
y la instalación final deben comprobarse en el dispositivo.
# gym-app
