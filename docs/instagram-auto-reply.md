# Instagram Auto Reply (Linksy)

Alguien comenta una publicación o reel del negocio con una palabra clave y recibe
un mensaje privado con un enlace; opcionalmente, también una respuesta pública
debajo del comentario. Como el «Auto Reply» de Linktree, hecho **exclusivamente
con la API oficial de Meta** («Instagram API with Instagram Login»): sin
scraping, sin navegador automatizado, sin contraseñas de Instagram, sin tokens
en el navegador.

Vive en el panel de cada página de Linksy: **`bookea.lat/solutions/panel/<id>/instagram`**.

---

## 1. Arquitectura

```
Instagram (alguien comenta)
   │
   ▼
Meta → POST /api/webhooks/instagram          firma X-Hub-Signature-256 (HMAC-SHA256, App Secret)
   │
   ▼
src/lib/instagram/webhook.ts                  verificar firma · leer entry[].changes[field=comments]
   │
   ▼
src/lib/instagram/motor.ts                    cuenta → automatizaciones del medio → palabra clave
   │                                          → registrar (índice único = idempotencia)
   │                                          → ¿token vigente? → ¿bajo el límite por hora?
   ▼
src/lib/instagram/meta.ts                     POST /<IG_ID>/messages  { recipient: { comment_id }, message: { text } }
                                              POST /<COMMENT_ID>/replies?message=…   (opcional)
   │
   ▼
solutions_instagram_eventos                   resultado, ids de Meta, error traducido
```

- **Síncrono a propósito.** El proyecto no tiene cola. El webhook procesa el
  comentario y responde según lo que pasó: si el envío falló por algo
  transitorio (rate limit, caída de Meta) devuelve **500** para que Meta
  reenvíe el aviso (Meta reintenta hasta 36 horas). Con `after()` un fallo así
  se perdería. Cada aviso es normalmente un comentario y una llamada a Graph.
- **Idempotencia en dos capas.** La base tiene un índice único
  `(automatizacion_id, comentario_id)`; el segundo INSERT del mismo comentario
  falla y el motor lo lee como «duplicado» y no manda nada. Además Meta solo
  permite **una** respuesta privada por comentario: si un reintento se colara,
  Meta lo rechaza (`dm_rechazado`).
- **El token nunca sale.** Se guarda cifrado (AES-256-GCM,
  `META_TOKEN_ENCRYPTION_KEY`), el GRANT de lectura del equipo excluye la
  columna, y ninguna server action lo devuelve. En los logs y en la bitácora
  solo van nuestros códigos de error con el mensaje de Meta redactado.

### Archivos

| Capa | Archivo | Qué hace |
|---|---|---|
| Config | `src/lib/instagram/config.ts` | Variables de entorno, scopes, hosts |
| Puro | `oauth.ts` · `webhook.ts` · `coincidencia.ts` · `mensaje.ts` · `tokens.ts` · `cifrado.ts` · `motor.ts` · `datos.ts` | Cada uno con su `.test.ts` |
| Meta | `meta.ts` | Los endpoints de Graph, uno por función |
| Persistencia | `cuentas.ts` · `repo.ts` | Supabase con la llave de servicio |
| Rutas | `src/app/api/instagram/conectar` · `/callback` · `/refrescar-tokens` · `src/app/api/webhooks/instagram` | OAuth, cron, webhook |
| Panel | `src/app/solutions/panel/[id]/instagram/` | Página, acciones, cuenta, lista, formulario |
| Base | `supabase/migrations/0238_instagram_auto_reply.sql` | Cuatro tablas + avisos crudos, RLS |

---

## 2. Configurar la app en Meta Developer

Todo esto lo hace el dueño en **https://developers.facebook.com/apps**. Nada de
esto se puede simular desde el código.

### 2.1 Crear la app
1. **Create App** → tipo **Business** (la doc de Meta exige app de tipo
   Business para Instagram API with Instagram Login).
2. En el dashboard de la app, **Add product → Instagram**.
3. Anotar **App settings → Basic → App ID** y **App secret** (el secreto se
   muestra una vez; guardarlo en `META_APP_SECRET`).

### 2.2 Instagram → API setup with Instagram login
1. **Generate access tokens**: agregar las cuentas de Instagram de prueba
   (las del dueño). Mientras la app esté en *Development*, **solo estas
   cuentas** pueden conectarse.
2. **Set up Instagram business login**: en **OAuth redirect URIs** poner
   EXACTAMENTE la URL del callback:
   - producción: `https://www.bookea.lat/api/instagram/callback`
   - local: `http://localhost:3100/api/instagram/callback` (Meta acepta http solo en localhost)
   Copiar esa misma URL en `META_REDIRECT_URI` — tiene que coincidir byte a byte.
3. **Set up webhooks** (mismo panel de Instagram):
   - **Callback URL**: `https://www.bookea.lat/api/webhooks/instagram` (HTTPS obligatorio)
   - **Verify token**: el texto que pusiste en `META_WEBHOOK_VERIFY_TOKEN`
   - Tocar **Verify and save**: Meta hace un GET con `hub.challenge` y nuestro
     endpoint lo devuelve si el token coincide.
   - En **Webhook fields**, suscribir **`comments`**.

   En local, Meta no puede llegar a tu máquina: usá un túnel (por ejemplo
   `ngrok http 3100`) y poné esa URL `https://…ngrok…/api/webhooks/instagram`.

### 2.3 Permisos (scopes)
El código pide exactamente estos tres, y nada más:

| Scope | Para qué |
|---|---|
| `instagram_business_basic` | perfil (`/me`) y publicaciones (`/<IG_ID>/media`) |
| `instagram_business_manage_comments` | leer comentarios por webhook, responder en público y en privado |
| `instagram_business_manage_messages` | mandar el DM |

Los scopes viejos (`business_basic`, `business_manage_messages`…) están
deprecados desde el 27 de enero de 2025 y no se usan.

### 2.4 Development vs Live, y App Review
- En **Development mode** todo funciona **solo para las cuentas con rol en la
  app** (admins, developers, testers de Instagram). Es suficiente para probar
  el flujo completo con las cuentas del dueño.
- Para que **cualquier negocio** conecte su Instagram, la app necesita
  **Advanced Access** en los tres permisos, y eso requiere **App Review** y
  **Business Verification** en Meta. Además la app tiene que estar en
  **Live** para recibir webhooks de cuentas ajenas. Es un trámite de Meta,
  con formulario y video del flujo; no lo hace el código.

### 2.5 Requisitos de la cuenta que se conecta
- Cuenta **profesional**: `account_type` = `BUSINESS` o `MEDIA_CREATOR`. Una
  cuenta personal no puede usar la API; el callback la rechaza con
  «cuenta_incompatible».
- No hace falta Página de Facebook (es la ventaja de Instagram Login).

---

## 3. Variables de entorno

| Variable | Obligatoria | Qué es |
|---|---|---|
| `META_APP_ID` | sí | App ID de la app de Meta (App settings → Basic) |
| `META_APP_SECRET` | sí | App secret de la app de Meta. Firma el `state` de OAuth y verifica la firma del webhook |
| `META_IG_APP_ID` | sí | **Instagram app ID** (Instagram → API setup with Instagram login → Business login settings). Es otro número que el App ID de Meta; es el `client_id` del OAuth y del canje del token |
| `META_IG_APP_SECRET` | sí | **Instagram app secret**, de esa misma pantalla. `client_secret` del canje y de la renovación del token largo |
| `META_REDIRECT_URI` | sí | La URL exacta del callback registrada en Meta |
| `META_API_VERSION` | no | Versión de Graph; por defecto `v25.0` |
| `META_WEBHOOK_VERIFY_TOKEN` | sí | El texto del campo *Verify token* del webhook. `openssl rand -hex 16` |
| `META_TOKEN_ENCRYPTION_KEY` | sí | 32 bytes en hex (`openssl rand -hex 32`) para cifrar los tokens en la base. **Si se pierde, hay que reconectar cada cuenta** |
| `CRON_SECRET` | ya existía | Protege `/api/instagram/refrescar-tokens` |

Sin las cinco obligatorias, la sección Instagram del panel dice «no está
configurado» y ninguna otra parte del sitio cambia. En Vercel van en
*Settings → Environment Variables* (Production); en local, en `.env.local`.

---

## 4. Base de datos

Migración **`0238_instagram_auto_reply.sql`** (aditiva; no toca ninguna tabla
existente). Se aplica con `supabase db push --linked` o pegándola en el SQL
Editor (¡con una línea en blanco adelante, ver la nota del repo!).

| Tabla | Qué guarda |
|---|---|
| `solutions_instagram_cuentas` | una por página de Linksy (`negocio_id` único); `ig_user_id` único en toda la base; token cifrado; vencimiento; permisos; estado |
| `solutions_instagram_automatizaciones` | publicación (`media_id`), disparador, modo de coincidencia, mensaje privado, enlace, respuesta pública |
| `solutions_instagram_palabras` | las palabras clave, tal cual y normalizadas |
| `solutions_instagram_eventos` | un comentario → qué pasó. **Índice único (automatización, comentario) = idempotencia** |
| `solutions_instagram_webhooks` | los avisos crudos (recortados), para depurar; se limpian a 30 días |

RLS: el equipo del negocio **lee** lo suyo (`solutions_es_del_equipo`), y en la
cuenta el GRANT de select **no incluye `token_cifrado`**. Nadie escribe desde el
cliente: todo entra por server actions y rutas con la llave de servicio.

---

## 5. Flujo de OAuth

1. Panel → **Conectar Instagram** → `GET /api/instagram/conectar?negocio=<id>`.
   Exige sesión y `verificarAccesoSolutions` con `puedeEditar`. Firma un
   `state` (negocio + usuario + nonce + vencimiento a 10 min, HMAC-SHA256 con
   el App Secret) y deja el nonce en una cookie `httpOnly`.
2. Redirige a `https://www.instagram.com/oauth/authorize` con `client_id`,
   `redirect_uri`, `response_type=code`, `scope` y `state`.
3. Meta vuelve a `GET /api/instagram/callback?code&state`. Se verifica el
   `state` (firma, vencimiento) y que el nonce coincida con la cookie; que la
   sesión sea **la misma persona** que arrancó; y que siga pudiendo editar el
   negocio.
4. `POST https://api.instagram.com/oauth/access_token` → token corto (1 h) →
   `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token`
   → token largo (60 días).
5. `GET /me?fields=id,user_id,username,name,account_type,profile_picture_url`.
   Si no es `BUSINESS`/`MEDIA_CREATOR`, se rechaza.
6. `POST /me/subscribed_apps?subscribed_fields=comments` — la cuenta queda
   suscrita al webhook. Si falla, la cuenta se guarda igual con
   `suscrito_webhook = false` y el panel ofrece **Reintentar suscripción**.
7. Se guarda (token cifrado) y se vuelve al panel con `?instagram=conectado`.

### Refresco del token
`GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token`
— Meta lo permite si el token tiene ≥24 h y no venció; el nuevo dura 60 días.
Se hace en dos lugares: al abrir el panel (si toca) y en el cron
`GET /api/instagram/refrescar-tokens` (con `Authorization: Bearer CRON_SECRET`).
Para programarlo en Vercel, agregar a `vercel.json`:

```json
{ "path": "/api/instagram/refrescar-tokens", "schedule": "0 9 * * *" }
```

(No se tocó `vercel.json` desde el código: es decisión del dueño.) Un token
vencido **no se puede refrescar**: la cuenta pasa a «reconectar» y el panel lo
dice.

---

## 6. Crear una automatización

Panel → Instagram → **Crear automatización**:
- **Publicación**: se elige de la lista que devuelve `GET /<IG_ID>/media`
  (miniatura, texto, fecha, tipo). Si la lista no carga, se puede pegar el ID
  numérico a mano.
- **Disparador**: una palabra clave o cualquier comentario.
- **Palabras clave**: hasta 20, de hasta 40 caracteres. **Modo de comparación**:
  *palabra entera* (default: «precio» sí, «precioso» no; sin mayúsculas ni
  acentos), *comentario exacto*, *contiene*.
- **Mensaje privado** (hasta 800 caracteres) + **enlace** (https, dominio
  público; por defecto la página de Linksy). Se validan juntos contra el tope
  de Meta: 1000 bytes UTF-8.
- **Respuesta pública** opcional (hasta 300 caracteres).

---

## 7. Probar de punta a punta

1. Con la app en Development y tu Instagram como tester: conectar desde el
   panel. Debe volver con «Instagram conectado» y la card mostrar
   *Suscrita al webhook ✓*.
2. Crear una automatización sobre una publicación tuya con la palabra `precio`.
3. Desde **otra** cuenta de Instagram (también tester mientras la app esté en
   Development), comentar «¿precio?» en esa publicación.
4. En unos segundos: la cuenta comentarista recibe el DM; en la bitácora del
   panel aparece la fila con **DM enviado**; los contadores suben.
5. Comentar de nuevo con la misma palabra desde la misma cuenta: Meta manda
   otro comentario (otro id) → otro DM. Si Meta **reenvía** el mismo aviso, la
   bitácora no cambia (duplicado).

Para ver los avisos crudos: `select * from solutions_instagram_webhooks order by recibido_en desc`.

---

## 8. Troubleshooting

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Panel dice «Instagram no está configurado» | falta alguna `META_*` | ver la lista de faltantes en la card |
| Al conectar vuelve con «state» | cookie bloqueada, más de 10 min en la pantalla de permisos, o abrió el link en otro navegador | volver a tocar Conectar |
| Vuelve con «cuenta_incompatible» | cuenta personal | pasarla a profesional en Instagram → Configuración |
| Vuelve con «permisos» | no aceptó los tres permisos, o la app no tiene Advanced Access y la cuenta no es tester | reconectar aceptando todo; revisar el modo de la app |
| «Sin suscribir — los comentarios no llegan» | falló `subscribed_apps` | **Reintentar suscripción**; revisar que el producto Webhooks tenga el campo `comments` |
| Meta no verifica la URL del webhook | `META_WEBHOOK_VERIFY_TOKEN` distinto al del dashboard, o la URL no es HTTPS pública | corregir y **Verify and save** de nuevo |
| Comentan y no pasa nada | la app no está en Live (webhooks solo para testers en Development); la cuenta no está suscrita; el comentario es del propio negocio; la publicación no es la de la automatización | revisar `solutions_instagram_webhooks` (¿llegó?) y la bitácora (¿resultado?) |
| Bitácora: «Instagram necesita reconectar esta cuenta» | token vencido o revocado (code 190) | Reconectar |
| Bitácora: «Instagram rechazó el mensaje privado» | ya se respondió ese comentario, o pasaron más de 7 días | nada que hacer: es la regla de Meta |
| Bitácora: «límite» | más de 600 DMs en una hora en esa cuenta (Meta permite 750) | espera; se anota y no se manda |

---

## 9. Limitaciones actuales de Meta (verificadas en la doc oficial, sep 2026)

- **Una sola respuesta privada por comentario**, y solo **dentro de los 7 días**
  del comentario. Un comentario que ya se respondió no se puede volver a
  responder.
- La respuesta privada es **texto** (`message.text`, UTF-8, ≤1000 bytes); los
  enlaces van como URL dentro del texto. No hay botones, tarjetas ni plantillas
  para respuestas privadas a comentarios.
- Solo comentarios en **publicaciones y reels de la propia cuenta**.
- **Rate limit**: 750 respuestas privadas por hora por cuenta (posts/reels);
  error `80002` cuando Instagram limita. El motor frena a 600.
- **Cuentas profesionales** únicamente (Business / Creator).
- **Development mode** = solo cuentas con rol en la app. Para el público:
  App Review + Business Verification + app en Live.
- Los webhooks **solo llegan a URLs HTTPS públicas** y **solo con la app en Live**
  (o para testers, en Development).
- No existe endpoint para «responder a todos los comentarios anteriores»: solo
  se procesan comentarios que llegan por webhook después de conectar.

Referencias:
- Business Login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
- Private replies: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/private-replies
- Messaging (límites, formato): https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
- Comment moderation (replies): https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/comment-moderation
- Webhooks: https://developers.facebook.com/docs/instagram-platform/webhooks
- Refresh token: https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token
- Overview (acceso, rate limits): https://developers.facebook.com/docs/instagram-platform/overview
- Rate limiting: https://developers.facebook.com/docs/graph-api/overview/rate-limiting
