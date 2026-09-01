# Publicar Bookea en el App Store y en Google Play

Estado al **1 sep 2026**, verificado contra el código y contra
producción — no contra lo que la guía anterior suponía.

---

## ⛔ LO ÚNICO QUE HOY BLOQUEA EL ENVÍO

**Falta «Iniciar sesión con Apple».**

La app ofrece login con **Google y Facebook**
(`mobile/src/components/botones-sociales.tsx`, que se pinta en
`perfil.tsx`), y en el perfil de producción esos botones vienen
encendidos (`EXPO_PUBLIC_AUTH_GOOGLE=1` y `EXPO_PUBLIC_AUTH_FACEBOOK=1`
en `eas.json`).

La **guía 4.8 de Apple** dice que una app que ofrece login de un tercero
para crear la cuenta principal tiene que ofrecer TAMBIÉN una opción
equivalente que respete la privacidad: solo nombre y correo, que se
pueda esconder el correo real, y sin rastreo. Google y Facebook no
califican. *Iniciar sesión con Apple* sí.

Hay **dos caminos**, y conviene elegir a conciencia:

| | Qué implica | Cuánto tarda |
|---|---|---|
| **A. Agregar Sign in with Apple** | `expo-apple-authentication` + habilitar Apple como proveedor en Supabase + la capability en el perfil de Apple. Es el camino sin riesgo y el que hay que hacer tarde o temprano. | Media jornada de trabajo |
| **B. Apagar los sociales solo en iOS** | Poner `EXPO_PUBLIC_AUTH_GOOGLE` y `EXPO_PUBLIC_AUTH_FACEBOOK` en `"0"` para el build de iOS. Sin login de terceros, la 4.8 no se activa y queda solo el correo con código. | 5 minutos |

> Un matiz honesto: el login principal de la app es **correo + código**,
> que recoge solo el correo. Hay revisores que lo aceptan como «la opción
> equivalente» y dejan pasar Google/Facebook. Pero es criterio del
> revisor, no una regla escrita, y perder un ciclo de revisión cuesta
> más días que hacer A o B.

---

## ✅ Lo que YA está resuelto (verificado, no supuesto)

| Requisito | Estado |
|---|---|
| App creada en App Store Connect | ✅ `ascAppId: 6802875407` en `eas.json` |
| Llave de API de Apple para subir | ✅ `apple/AuthKey_ZWRZFHG45C.p8` (ignorada por git, como debe ser) |
| Proyecto vinculado a EAS | ✅ `projectId 4d127275-…` en `app.json` |
| Bundle / package | ✅ `lat.bookea.app` en las dos plataformas |
| **Borrar la cuenta desde la app** (Apple 5.1.1 v) | ✅ Ajustes → «Eliminar cuenta», y la función `eliminar_mi_cuenta` **existe en producción** (se comprobó por RPC) |
| Textos de permisos (cámara, fotos, ubicación) | ✅ los cuatro escritos en español y específicos, en `app.json` |
| Declaración de encriptación | ✅ `ITSAppUsesNonExemptEncryption: false` |
| **No vender contenido digital** (Apple 3.1.1) | ✅ deliberado: la app no muestra precios ni paquetes ni botón de compra (ver la cabecera de `mobile/src/app/lealtad.tsx`) |
| Política de privacidad pública | ✅ `https://bookea.lat/privacidad` |
| Ícono, splash, número de build automático | ✅ `autoIncrement` + `appVersionSource: remote` |

---

## Lo que tenés que hacer, en orden

### 0. Instalar la CLI

No está instalada en esta máquina (`npx eas whoami` falla).

```bash
npm install -g eas-cli
eas login
```

### 1. Resolver el bloqueo de la 4.8

Elegí A o B de la tabla de arriba. **No sigas sin decidir esto** — es la
causa número uno de rechazo en la primera revisión.

### 2. El build de iOS

```bash
cd mobile
eas build --platform ios --profile production
```

La primera vez pregunta por las credenciales de Apple: decile que sí a
todo, EAS crea y administra los certificados. Tarda 15–25 minutos.

### 3. Subirlo

```bash
eas submit --platform ios --latest
```

Con el `ascAppId` y la llave `.p8` ya configurados, esto no debería
preguntar nada.

### 4. La ficha en App Store Connect

En [appstoreconnect.apple.com](https://appstoreconnect.apple.com):

- **Nombre**: Bookea · **Subtítulo**: «Reservá espacios y servicios».
- **Capturas**: iPhone 6.7" y 6.5". La app es solo iPhone
  (`supportsTablet: false`), así que no piden capturas de iPad.
- **URL de privacidad**: `https://bookea.lat/privacidad`.
- **App Privacy**: declarar *Email address* y *Name* (la cuenta),
  *Photos* (las que el negocio sube) y *Other user content* (mensajes y
  reservas). Todo «linked to user», **nada de tracking**.
- **Cuenta de prueba para el revisor** — es lo que más rechazos evita.
  El login es por código al correo, así que el revisor no puede entrar
  solo. Dejá en «App Review Information» una cuenta real cuyo buzón
  puedas mirar durante la revisión, y una nota explicando el flujo del
  código. Si elegiste el camino A, decile también que puede entrar con
  Sign in with Apple.

### 5. Enviar a revisión

«Add for Review». La primera revisión suele tardar 1–3 días.

---

## Google Play

Menos exigente en lo de arriba, pero pide su propia burocracia:

```bash
eas build --platform android --profile production   # genera el .aab
eas submit --platform android
```

En Play Console hace falta además:

- **Formulario de Seguridad de los datos** — el equivalente al App
  Privacy de Apple. Mismos datos que la tabla de arriba.
- **Política de privacidad**: `https://bookea.lat/privacidad`.
- **Clasificación de contenido** (cuestionario) y **público objetivo**.
- Google Play NO exige Sign in with Apple: el bloqueo de la 4.8 es solo
  de Apple. La app puede salir en Android antes que en iOS.

---

## Cada actualización futura

```bash
eas build --platform ios --profile production && eas submit --platform ios --latest
```

`buildNumber` y `versionCode` suben solos.

---

## ⚠️ Y ojo con esto: un cambio de JS NO necesita pasar por la tienda

La app usa **EAS Update** (`updates.url` en `app.json`, canal
`production`). Un arreglo que sea solo JavaScript se publica así, sin
revisión de Apple:

```bash
cd mobile
eas update --channel production -m "qué se arregló"
```

Es lo que hay pendiente hoy: el filtro que saca los 99 negocios del
demo de los listados está commiteado desde el **27 ago** y **nunca se
publicó** — el último bundle exportado es del 25 ago. Por eso la app
sigue mostrando las demos aunque el código esté arreglado.

Un build nuevo (pasos 2 y 3) solo hace falta cuando cambia algo nativo:
un permiso, una dependencia con código nativo, el ícono o la versión.
