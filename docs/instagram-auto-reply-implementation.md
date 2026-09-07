# Instagram Auto Reply — informe de implementación

Fecha: 7 sep 2026. Alcance: Linksy (Solutions). Estado: **implementado,
verificado, migración aplicada y desplegado el 7 sep 2026** (el dueño pidió el
deploy al configurar la app de Meta).

La guía de configuración, arquitectura, troubleshooting y limitaciones está en
[`docs/instagram-auto-reply.md`](./instagram-auto-reply.md).

---

### Implementado

- **OAuth con Meta (Instagram API with Instagram Login)**: inicio con `state`
  firmado (HMAC-SHA256, 10 min, atado a negocio + usuario + nonce en cookie
  httpOnly), callback con verificación de firma, nonce, sesión y permiso de
  edición; canje de código → token corto → token largo (60 días); lectura de
  perfil; rechazo de cuentas no profesionales; suscripción al campo `comments`.
- **Tokens**: cifrados en la base con AES-256-GCM (`META_TOKEN_ENCRYPTION_KEY`),
  columna excluida del GRANT de lectura, nunca devueltos al cliente; estados
  vigente / por vencer / vencido; refresco automático (Meta: ≥24 h y no
  vencido) al abrir el panel y por cron protegido con `CRON_SECRET`; detección
  de token inválido (code 190) → cuenta en «reconectar».
- **Webhook** `GET`/`POST /api/webhooks/instagram`: verificación
  `hub.mode`/`hub.verify_token`/`hub.challenge`; firma `X-Hub-Signature-256`
  en tiempo constante antes de leer nada; parseo tolerante del payload de
  `comments`; registro del aviso crudo (recortado); procesamiento síncrono con
  500 en fallos transitorios para que Meta reenvíe.
- **Motor** (`procesarComentario`): cuenta → automatizaciones activas del
  medio → primera coincidencia → registro idempotente → token → freno local
  (600/h, Meta permite 750) → DM privado (`POST /<IG_ID>/messages` con
  `recipient.comment_id`) → respuesta pública opcional (`POST /<COMMENT_ID>/replies`)
  → bitácora. Ignora comentarios del propio negocio y cuentas desconocidas o
  inactivas. Una sola automatización responde por comentario.
- **Coincidencia configurable**: `palabra` (entera, sin mayúsculas ni acentos,
  sin falsos positivos por sub-palabras), `exacta`, `contiene`; frases
  multi-palabra; saneo y deduplicación de la lista.
- **Idempotencia**: índice único `(automatizacion_id, comentario_id)` (+
  `(cuenta_id, comentario_id)` para los sin coincidencia); el INSERT es la
  puerta; reintentos solo para errores transitorios y hasta 3 intentos; Meta
  además rechaza un segundo DM al mismo comentario.
- **Errores**: `clasificarErrorMeta` traduce códigos de Graph a
  `token_vencido`, `permisos`, `cuenta_incompatible`, `rate_limit`,
  `no_procesable`, `dm_rechazado`, `webhook_invalido`, `api_no_disponible`,
  `desconocido`; mensajes redactados (nunca tokens ni secretos); textos para
  el panel («Instagram necesita reconectar esta cuenta»).
- **Seguridad**: gate `verificarAccesoSolutions` + `puedeEditar` en toda
  acción y ruta; ownership por `negocio_id` en cada UPDATE/DELETE; validación
  de inputs con topes espejados en CHECKs; enlace del DM solo https a dominio
  público (sin IPs, localhost, credenciales); secretos solo en servidor; RLS
  sin escritura para clientes.
- **Dashboard** (`/solutions/panel/<id>/instagram`, pestaña «Instagram» en el
  rail): cuenta (foto, @usuario, tipo, estado, fecha, token, suscripción,
  conectar/reconectar/desconectar/renovar/reintentar suscripción);
  automatizaciones (nombre, publicación con miniatura, palabras, estado,
  comentarios/DMs/errores/última actividad; crear, editar, activar/pausar,
  borrar, estadísticas); formulario con selector de publicaciones desde
  `GET /<IG_ID>/media` (miniatura, texto, fecha, tipo) o ID manual; bitácora
  de los últimos comentarios; métricas globales (comentarios, DMs, tasa de
  respuesta, errores).
- **Analítica**: agregación pura desde `solutions_instagram_eventos`
  (`resumenPorAutomatizacion`, `resumenGlobal`). Linksy no tenía analítica
  propia; esta es la primera y queda como patrón para la de visitas/clics.

### Archivos

Nuevos:
- `supabase/migrations/0238_instagram_auto_reply.sql`
- `src/lib/instagram/` — `tipos.ts`, `config.ts`, `cifrado.ts`, `oauth.ts`,
  `coincidencia.ts`, `webhook.ts`, `mensaje.ts`, `tokens.ts`, `meta.ts`,
  `motor.ts`, `datos.ts`, `cuentas.ts`, `repo.ts` y sus 9 `*.test.ts`
- `src/app/api/instagram/conectar/route.ts`, `…/callback/route.ts`,
  `…/refrescar-tokens/route.ts`, `src/app/api/webhooks/instagram/route.ts`
- `src/app/solutions/panel/[id]/instagram/` — `page.tsx`, `actions.ts`,
  `seccion-cuenta.tsx`, `lista-automatizaciones.tsx`,
  `formulario-automatizacion.tsx`
- `docs/instagram-auto-reply.md`, `docs/instagram-auto-reply-implementation.md`

Modificados:
- `src/app/solutions/panel/[id]/page.tsx` — pestaña «Instagram» (import de
  `IconInstagram` + un `tabs.push`)
- `.env.example`, `.env.local.example` — variables `META_*`

No se tocó ninguna tabla existente, ni `next.config.ts`, ni `vercel.json`.

### Migraciones

- `0238_instagram_auto_reply.sql` — **aplicada el 7 sep 2026** con
  `supabase db push --linked` (dry-run limpio; verificado después contra la
  base: tablas, índices únicos, políticas RLS y que `authenticated` no ve
  `token_cifrado`). Aditiva: crea
  `solutions_instagram_cuentas`, `solutions_instagram_automatizaciones`,
  `solutions_instagram_palabras`, `solutions_instagram_eventos`,
  `solutions_instagram_webhooks`, sus índices (incluido el único de la
  idempotencia), RLS, GRANTs y una función de limpieza. Se aplica con
  `supabase db push --linked` cuando el dueño lo indique. Hasta entonces la
  sección del panel muestra la card de cuenta y las acciones devuelven un
  error legible al tocar la base.

### Variables de entorno

| Variable | Valor |
|---|---|
| `META_APP_ID` | App ID de la app de Meta (App settings → Basic) |
| `META_APP_SECRET` | App secret de la app de Meta (solo servidor): firma del webhook y del `state` |
| `META_IG_APP_ID` | **Instagram app ID** (Instagram → API setup with Instagram login → Business login settings): el `client_id` del OAuth |
| `META_IG_APP_SECRET` | **Instagram app secret** de esa pantalla: canje y renovación de tokens |
| `META_REDIRECT_URI` | `https://www.bookea.lat/api/instagram/callback` (prod) · `http://localhost:3100/api/instagram/callback` (local) |
| `META_API_VERSION` | opcional, `v25.0` por defecto |
| `META_WEBHOOK_VERIFY_TOKEN` | inventado: `openssl rand -hex 16`, el mismo que en el dashboard |
| `META_TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `CRON_SECRET` | ya existe; protege el cron de tokens |

### Configuración Meta (paso a paso)

1. developers.facebook.com → **Create App** → tipo **Business** → **Add product: Instagram**.
2. **App settings → Basic**: copiar App ID y App secret → `META_APP_ID`, `META_APP_SECRET`.
   Y en **Instagram → API setup with Instagram login → Business login settings**: copiar el *Instagram app ID* y el *Instagram app secret* → `META_IG_APP_ID`, `META_IG_APP_SECRET` (7 sep 2026: son distintos de los de Meta; el OAuth con el App ID de Meta falla).
3. **Instagram → API setup with Instagram login → Set up Instagram business login → OAuth redirect URIs**: `https://www.bookea.lat/api/instagram/callback` → mismo valor en `META_REDIRECT_URI`.
4. **Instagram → Set up webhooks**: Callback URL `https://www.bookea.lat/api/webhooks/instagram`, Verify token = `META_WEBHOOK_VERIFY_TOKEN`, **Verify and save**, suscribir el campo **`comments`**.
5. **Generate access tokens**: agregar como tester la cuenta de Instagram con la que se va a probar.
6. Permisos que usa el código (no elegir otros): `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`.
7. Poner las variables en Vercel (Production) y desplegar (con la regla vigente: push → ubicar el deployment → re-apuntar los cinco dominios).
8. Aplicar la migración 0238.
9. Para cuentas que no sean testers: **App Review + Business Verification** y pasar la app a **Live**.

Prueba end-to-end: en la guía, sección 7.

### Tests

`npm test` → **164 archivos, 3321 pruebas, todas en verde** (155 previas + 9
nuevas con 89 pruebas). `npx tsc --noEmit` limpio. `eslint` limpio en todo lo
tocado. `npm run build` exit 0, con las rutas `/api/instagram/conectar`,
`/api/instagram/callback`, `/api/instagram/refrescar-tokens`,
`/api/webhooks/instagram` y `/solutions/panel/[id]/instagram`.

Cobertura de los 17 casos pedidos:

| # | Caso | Prueba |
|---|---|---|
| 1 | OAuth state | `oauth.test.ts` (firma, manipulación, otro secreto, vencimiento, basura) |
| 2 | OAuth callback | lógica pura del state + `meta.test.ts` (`tokenLargo`, `perfilInstagram`); el handler compone piezas probadas |
| 3 | Webhook verification | `webhook.test.ts` (`responderVerificacion`) |
| 4 | Webhook parsing | `webhook.test.ts` (`extraerComentarios`, firma) |
| 5–7 | Keyword / case-insensitive / acentos | `coincidencia.test.ts` + `motor.test.ts` |
| 8–9 | Duplicate webhook / idempotencia | `motor.test.ts` («la segunda es duplicado») + índice único en 0238 |
| 10 | Authorization | state atado a usuario y negocio (`oauth.test.ts`); gate `portonEditar` en todas las acciones |
| 11 | Token expiration | `tokens.test.ts` + `motor.test.ts` (vencido → reconectar, sin llamar a Meta) |
| 12 | Meta API errors | `meta.test.ts` (12 códigos) + `motor.test.ts` (190, rate limit transitorio) |
| 13 | Private reply OK | `motor.test.ts` + `meta.test.ts` (cuerpo exacto, token en cabecera, no en URL) |
| 14 | Public reply OK | `motor.test.ts` |
| 15 | Automation disabled | `motor.test.ts` |
| 16 | Wrong media ID | `motor.test.ts` |
| 17 | Wrong Instagram account | `motor.test.ts` |

Además: cifrado ida/vuelta y manipulación, anti-SSRF del enlace, tope de
1000 bytes, freno por hora, reintentos con tope, estadísticas.

Smoke test en `localhost:3100` sin `META_*`: webhook 503, conectar → panel
con `motivo=sin_configurar`, cron 401, página del panel → login. Sin 500.

### Limitaciones (Meta, verificadas en la doc oficial)

- Una sola respuesta privada por comentario; solo dentro de 7 días.
- La respuesta privada es texto (≤1000 bytes UTF-8) con el enlace adentro; sin botones ni plantillas.
- Solo publicaciones/reels de la propia cuenta; solo cuentas profesionales.
- 750 respuestas privadas/hora/cuenta; el motor frena a 600.
- Development mode: solo cuentas con rol en la app. Público: App Review + Business Verification + Live.
- Webhooks solo a HTTPS públicas; en local hace falta un túnel (ngrok).
- No hay forma de responder comentarios anteriores a la conexión.

### Pendientes (necesarios)

1. ~~Aplicar la migración 0238~~ — hecho el 7 sep 2026.
2. **Crear la app en Meta** y cargar las seis variables (pasos 1–6 arriba).
3. **Desplegar** cuando el dueño lo diga; el webhook necesita la URL pública.
4. **Programar el cron** de tokens en `vercel.json` (una línea; queda a decisión del dueño). Mientras tanto el panel refresca al abrirse.
5. **App Review + Business Verification** en Meta para abrirlo a cualquier negocio.
6. QA visual de la sección del panel con una cuenta real conectada (no se pudo sin la app de Meta).
