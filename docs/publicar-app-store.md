# Publicar Bookea en el App Store (y Google Play)

Guía paso a paso para sacar la app. El código ya está listo: ícono,
splash, permisos declarados, política de privacidad pública
(bookea.lat/privacidad) y el botón de eliminar cuenta que Apple exige.

## Lo que ocupás antes de empezar

1. **Cuenta de Apple Developer** — $99 al año, en
   [developer.apple.com](https://developer.apple.com/programs/enroll/).
   La inscripción puede tardar 1–2 días.
2. **Cuenta de Expo** (gratis) en [expo.dev](https://expo.dev) y la CLI:
   `npm install -g eas-cli` y luego `eas login`.
3. **Correr la migración pendiente** en Supabase
   (`supabase/aplicar-migraciones-pendientes.sql`) — incluye la función
   `eliminar_mi_cuenta` que usa la app. Sin ella, Apple rechaza la app
   al probar el borrado de cuenta.

## Paso 1 — Vincular el proyecto con EAS

```bash
cd mobile
eas init          # crea el proyecto en tu cuenta de Expo y guarda el projectId
```

## Paso 2 — El build de producción para iOS

```bash
eas build --platform ios --profile production
```

- La primera vez pregunta por tus credenciales de Apple: decile que sí
  a todo — EAS crea y administra los certificados solo.
- `appVersionSource: remote` + `autoIncrement` ya están configurados:
  cada build sube el número solo, no hay que tocar nada.
- El build corre en la nube (~15–25 min). Al final da un link al `.ipa`.

## Paso 3 — Subirlo a App Store Connect

```bash
eas submit --platform ios --latest
```

La primera vez pide crear la app en App Store Connect; aceptá y EAS la
crea con el bundle `lat.bookea.app`.

## Paso 4 — La ficha en App Store Connect

En [appstoreconnect.apple.com](https://appstoreconnect.apple.com):

- **Nombre**: Bookea · **Subtítulo**: “Reservá espacios y servicios”.
- **Descripción**: contá lo mismo que dice la portada del sitio.
- **Capturas**: se piden de iPhone de 6.7" y 6.5". Sacalas con el
  simulador o un iPhone real (la app es solo iPhone, sin iPad, así que
  no piden capturas de tablet).
- **URL de privacidad**: `https://bookea.lat/privacidad`.
- **Privacidad de datos** (App Privacy): declarar que se recolectan
  *Email address* y *Name* (para la cuenta), *Photos* (solo las que el
  usuario sube de su negocio) y *Other user content* (mensajes y
  reservas). Todo “linked to user”, nada de tracking.
- **Encriptación**: ya declarada en el código
  (`ITSAppUsesNonExemptEncryption: false`) — no vuelve a preguntar.

## Paso 5 — Enviar a revisión

Botón “Add for Review”. La primera revisión tarda típicamente 1–3 días.
Consejos para que pase a la primera:

- En “App Review Information” dejá un correo de prueba REAL con el que
  el revisor pueda entrar (el login es por código al correo: creá una
  cuenta tipo `review@bookea.lat` y revisá ese buzón durante la
  revisión, o dejá una nota explicando el flujo del código OTP).
- Verificá antes que el borrado de cuenta funciona (Perfil → Eliminar
  mi cuenta) — es lo primero que revisan en apps con registro.

## Actualizaciones futuras

Cada nueva versión es repetir pasos 2 y 3 (`eas build` + `eas submit`)
y darle “Add for Review”. El `versionCode`/`buildNumber` sube solo.

## Google Play (cuando toque)

- Cuenta de Google Play Console ($25 una sola vez).
- `eas build --platform android --profile production` genera el `.aab`.
- `eas submit --platform android` lo sube. La ficha pide lo mismo
  (privacidad: `https://bookea.lat/privacidad`, capturas, descripción).

## Mientras tanto: repartir el APK de prueba

Sin cuentas de tienda, ya se puede compartir la app en Android:

```bash
eas build --platform android --profile preview
```

Da un link de descarga directa del APK que cualquiera puede instalar
(activando “instalar de fuentes desconocidas”).
