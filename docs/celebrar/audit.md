# CELEBRAR — Informe de auditoría (Fase 0)

> **Estado:** borrador para validación del dueño. No se tocó código ni base de datos.
> **Fecha:** 20 de setiembre de 2026 · commit auditado `889b23eb` (main).
> **Alcance:** todo el repo `aventurar-cr` (sitio Next.js + `supabase/` + `mobile/`), memoria del proyecto y configuración de Vercel/Cloudflare tal como está en el código.

Este documento responde al pedido «PROYECTO: CELEBRAR.LAT». Está ordenado con las
secciones A–Q del entregable. Al final hay una lista de **decisiones que solo el
dueño puede tomar** antes de empezar la Fase 1.

---

## 0. Lo que cambia el plan (leer primero)

Cuatro hallazgos que condicionan todo lo demás:

### 0.1 Bookea YA VENDE invitaciones digitales

No es un vacío que haya que llenar: es un producto vivo con clientes reales,
demos en catálogo, generador con IA, pedidos, pagos y una pantalla en la app
móvil. Migraciones 0066–0105 y 0209–0224. Rutas `/invitaciones`, `/i/[slug]`,
`/a/[slug]`, `/cuenta/invitaciones*`, `/admin/invitaciones`. Detalle en la
sección D.

Además, **en este momento hay un rediseño de la landing `/invitaciones` sin
commit en el árbol de trabajo** (`git status`: `page.tsx`, `precios-catalogo.tsx`,
`hero-vivo.tsx`, `telefono-vivo.tsx`, `vitrina-ejemplos.tsx`, `piezas-valor.tsx`,
`demo-confirmaciones.tsx`, `invitaciones.css` + capturas `inv-*.png`). Ese
trabajo es de otra sesión y **no se toca** desde CELEBRAR.

CELEBRAR es, en la práctica, la evolución de ese producto a marca propia. La
decisión más importante de esta auditoría es **cómo conviven** (sección 0.5 y
decisión D-1).

### 0.2 El dominio actual es `bookea.lat`, no `bookea.app`

`bookea.app` no aparece en el código, en Vercel ni en la memoria del proyecto;
solo existe `lat.bookea.app` como *bundle id* de la app móvil. Los dominios
reales del proyecto de Vercel `aventurar-cr` son `bookea.lat`, `www.bookea.lat`
(canónico, `SITIO` en `src/lib/sitio.ts`), `food.bookea.lat` (apagado),
`linksy.lat` y `www.linksy.lat`.

**Todo este informe usa `bookea.lat/celebrar` como URL temporal.** Si el dueño
sí tiene `bookea.app`, hay que agregarlo primero al proyecto de Vercel; la
arquitectura no cambia.

### 0.3 Linksy ya es el molde de «producto con dominio propio»

`linksy.lat/pizza-lucia` sirve `bookea.lat/s/pizza-lucia` sin duplicar un
archivo. El mecanismo vive en `src/lib/solutions/dominios.ts` (funciones puras
probadas en `dominios.test.ts`) y se ejecuta en `src/proxy.ts` (el
`middleware.ts` de Next 16). Tiene además el interruptor `NEXT_PUBLIC_LINKSY_URL`
que decide si los links y QR se generan con el dominio propio o con el de
Bookea. Es exactamente lo que pide la sección 4 del brief para `celebrar.lat`.
Detalle en G y P.

### 0.4 Despliegues congelados y migraciones pendientes

Por decisión del dueño (7 sep 2026) **todo se trabaja en local
(`localhost:3100`)**: ni push, ni `vercel --prod`, ni alias hasta que diga
«subilo». Al subir hay que re-aliasear los cinco dominios al deployment de ese
commit. Además, las migraciones **0239** (planes Linksy) y **0240** (reuniones
Lealtad) están escritas pero **no aplicadas** en producción. Las de CELEBRAR
arrancan en **0242** y hay que aplicarlas en orden con `supabase db push --linked`.

### 0.5 La decisión de fondo: esquema propio `celebrar_*` con puentes

Recomiendo **no construir CELEBRAR sobre las tablas `invitaciones` /
`invitacion_rsvp` / `albumes`** sino crear un esquema propio con prefijo
`celebrar_` (mismo precedente que `solutions_*` y `food_*`, y misma regla que el
dueño impuso el 3 sep 2026 para Solutions: «esquema propio, nunca sobre
`ranchos.detalles`»), **reutilizando la infraestructura** (auth, `media_assets`,
Stripe, `uso_ia`, Resend, saneador de HTML, retención, QR) y **portando las
plantillas existentes** como semillas del catálogo nuevo.

Por qué no reusar las tablas actuales:

| Tabla actual | Qué le falta para CELEBRAR | Por qué no conviene alterarla |
|---|---|---|
| `invitaciones` | No tiene «celebración» padre; el modelo es «HTML a la medida que arma el equipo» (`html_personalizado`); RLS es **solo lectura** para el dueño (escribe el service role); `tema`/`paleta` no son un sistema de plantillas; `slug` comparte espacio con `/i/` | La lee la app móvil (`mobile/src/app/invitaciones/index.tsx`), el admin, los correos y el sitemap; cambiar semántica de columnas rompe eso en silencio |
| `invitacion_rsvp` | Solo `nombre, acompanantes, asistira, mensaje, correo`; sin teléfono, estado (`pending/confirmed/declined`), restricciones, acompañantes nominales ni vínculo con una lista de invitados | Es insert anónimo (el dueño corrige/borra desde 0088); cambiar reglas afecta invitaciones ya activas |
| `albumes` / `album_fotos` | `path` apunta a Storage de Supabase (bucket `albumes`), no a `media_assets`; sin moderación ni privacidad | Tiene fotos reales de clientes y una retención de 5 años prometida |
| `pedidos_invitacion` | Vende paquetes, no créditos | Su ciclo de estados es el de un pedido de diseño a la medida |

Lo que **sí** se reutiliza y lo que se **porta** está en B y C. La alternativa
(extender las tablas actuales) queda documentada en la decisión D-1 con sus
costos.

---

## A. Arquitectura actual de Bookea

### A.1 Stack

| Pieza | Valor verificado |
|---|---|
| Framework | **Next.js 16.3.0** (App Router, `src/proxy.ts` en vez de `middleware.ts`, `after()` de `next/server`, Server Actions con `bodySizeLimit: 12mb`) |
| UI | React 19.2.4, Tailwind 4 (`@tailwindcss/postcss`), fuente global Figtree; Montserrat solo en Linksy |
| Lenguaje | TypeScript 5 estricto (regla del repo: sin `any`) |
| Base | Supabase (`bjhprmtobmualefvcmau.supabase.co`) — Postgres + Auth + Storage; **sin Edge Functions** (`supabase/functions/` no existe) |
| Deploy | **Un solo proyecto de Vercel** (`aventurar-cr`, `prj_z9n1EyU9…`), `vercel.json` con 3 crons y `ignoreCommand` (`scripts/vercel-construir-o-no.sh`) |
| Crons | 3 en Vercel (`/api/recordatorios`, `/api/auto-cobro`, `/api/hojas-impresas`) + 6 en GitHub Actions (`.github/workflows/`), autenticados con `CRON_SECRET` (`src/lib/cron-auth.ts`) |
| Pagos | Stripe SDK 22 (`stripe`), SINPE y transferencia con comprobante |
| Correo | Resend (`resend`), webhook de rebotes, supresiones y consentimientos |
| Media | Cloudflare R2 (`@aws-sdk/client-s3` + presigner) + Cloudflare Images; `sharp` en servidor |
| IA | `@anthropic-ai/sdk` y `@google/genai` detrás de una interfaz propia `AIProvider` |
| QR | `qrcode` (generar) y `jsqr` (leer); `node-forge` para pases de Wallet |
| Mapas | Leaflet |
| Tests | Vitest 4 (`npm test` = `vitest run`), **173 archivos `*.test.ts`**; la app móvil tiene su propio Vitest |
| Lint | ESLint 9 + `eslint-config-next` |
| Móvil | `mobile/` (Expo) comparte **la misma base**; `mobile-food/` ya no existe |

### A.2 Mapa de rutas (`src/app/`)

Productos y mundos que hoy conviven en el mismo `app/`:

- **Marketplace Bookea**: `/` (portada), `/[slug]` (ficha pública del negocio,
  atrapa cualquier primer segmento → ver `RESERVED_SLUGS` en `src/lib/slug.ts`),
  `/eventos/[…]`, `/citas/[…]`, `/hospedajes`, `/publicar`, `/negocios`,
  `/reclamar`, `/mensajes`, `/mi-negocio/*` (panel del proveedor), `/cuenta/*`
  (cuenta del usuario), `/admin/*`.
- **Invitaciones digitales**: `/invitaciones/*`, `/i/[slug]`, `/a/[slug]`,
  `/cuenta/invitaciones*`, `/cuenta/evento/[id]`, `/admin/invitaciones`,
  `/api/invitaciones/*` (`/invitacion/:slug` → rewrite a `/i/:slug`).
- **Lealtad**: `/lealtad/*`, `/tarjeta/*`, `/r/[slug]`, `/api/lealtad/*`,
  `/api/pases*`, `/api/wallet`.
- **Solutions / Linksy**: `/solutions/*`, `/linksy/*`, `/s/[slug]`, `/soluciones`.
- **Apagados o legado**: `/food` (borrado), `/restaurantes`, `/demo`,
  `/demo-bookea`, `/panel-demo`, `/prueba`, `/puntaleona-web`, `/invitaciones2`
  (una sola `page.tsx`, borrador), `/booking`, `/experiencias`, `/servicios`.

**El `layout.tsx` raíz es mínimo**: `<html lang="es">`, fuente Figtree,
`globals.css`, metadata de Bookea y **un solo componente global:
`<ChatFlotante />`** (burbuja de mensajes). No hay header ni footer globales:
cada sección monta el suyo (`SiteHeader`, `nav-solutions`, etc.). Eso facilita
que `/celebrar` tenga su propio shell — con una salvedad: la burbuja del chat
**no filtra por ruta** (`src/components/chat-flotante.tsx` usa `usePathname`
solo para recargar) y aparecería dentro de CELEBRAR. Ver riesgo R-5.

### A.3 El proxy (`src/proxy.ts`)

Corre en todas las rutas salvo estáticos. En orden:

1. **Host `linksy.lat`** → `destinoEnLinksy(pathname)` decide `rewrite`
   (`/` → `/linksy`, `/<slug>` → `/s/<slug>`), `redirect`, `bookea` (manda al
   mundo con sesión en `bookea.lat` porque **la cookie no cruza apex distintos**)
   o `pasar`.
2. **Host ajeno** (dominio propio de un negocio de Solutions, 0234) →
   `slugPorDominio(host)` con caché de 60 s y llave anónima → rewrite a
   `/s/<slug>`.
3. **Guardas de sesión**: `/admin/*` y `/mi-negocio/*`. Sin cookie
   `sb-…-auth-token` no se llama a Supabase (el arreglo de rendimiento más
   grande del sitio). Con cookie, `getUser()` y para `/admin` se lee
   `perfiles.rol` (`admin` entra a todo; `moderador` solo a `/admin/moderacion`).

### A.4 Diseño

Tokens de marca en clases Tailwind `aventurea-*` (navy, orange, sky, green,
blue). Fundamentos en `docs/fundacion-visual.md`. Reglas vigentes de la memoria:
paneles CRM en blanco y azules (cero naranja), admin en navy/negro, «vidrio»
solo ≥640 px, cuidado con el modo oscuro forzado de Android en superficies
translúcidas. Linksy demuestra que un producto puede tener su propia fuente y
paleta dentro del mismo `globals.css` (clase de ámbito `.linksy`).

---

## B. Qué podemos reutilizar (y cómo)

| Capa | Pieza concreta | Cómo la usa CELEBRAR | Toca código de Bookea? |
|---|---|---|---|
| **Auth** | Supabase Auth (Google, Facebook, código por correo), `src/app/cuenta/formulario-auth.tsx` (`destino=`), `src/components/formulario-codigo-acceso.tsx`, `/auth/callback?next=` (valida ruta interna segura), `usuarioActual()` / `perfilActual()` / `requireAdmin()` en `src/lib/auth.ts`, clientes `src/lib/supabase/{server,client,admin,bearer}.ts` | `/celebrar/entrar` monta `FormularioAuth destino="/celebrar/app"` igual que hace `/linksy/login`. Misma cuenta, sin registro nuevo | No |
| **Usuarios** | `auth.users` + `perfiles` (`id, email, nombre, rol`) | CELEBRAR NO agrega columnas a `perfiles`: crea `celebrar_perfiles (id → auth.users)` con lo suyo | No |
| **Admin** | `perfiles.rol = 'admin'`, `is_admin()` SQL, `requireAdmin()`, guardia del proxy | El admin de CELEBRAR vive en `/celebrar/admin/*` con su propio shell pero la **misma llave**: `requireAdmin()` + `is_admin()` en RLS | Sí, mínimo: agregar `/celebrar/admin` a la guardia del proxy (1 condición) |
| **Pagos** | `stripeDelEntorno()`, Checkout `mode: "payment"` (`src/lib/pagos/checkout-invitaciones.ts` como modelo), webhook `/api/stripe/webhook` con firma + idempotencia (`eventos_stripe`), abstracción `Puerta` + `procesarEventoStripe`, SINPE/transferencia (`src/lib/pagos-bookea.ts`, flujo de comprobante de `pedidos_invitacion`) | Un `checkout-celebrar.ts` que marca `metadata.bookea_producto = 'celebrar_creditos'` y `pedido_id`; el webhook acredita créditos | Sí, mínimo y aditivo: hoy `mode === "payment"` asume invitación (`cobrarInvitacion` devuelve `ignorado` si el producto no es `invitacion`). Hay que **ramificar por `bookea_producto`** antes de esa llamada. Con test |
| **Correo** | `enviarCorreo()` (Resend), `layoutBento`, `escaparHtml`, webhook de rebotes, `supresiones_correo`, `/baja` | Plantillas propias de CELEBRAR (marca, remitente `RESEND_FROM_EMAIL_CELEBRAR` opcional) sobre el mismo transporte | No (nueva variable opcional) |
| **Media** | `media_assets` (0110–0115) con R2 + Cloudflare Images, `/api/media/sesion`, `/sesion-anonima`, `/confirmar`, **capacidades anónimas** (token de 15 min, 10 usos — pensado para invitados de álbum), Turnstile, cuotas (`LIMITE_COMERCIAL_ALBUM = 160`), variantes `thumb/card/gallery/hero`, `resolverVisual()`, auditoría y **módulo de precios** `src/lib/media/precios.ts` | Nuevas entidades `celebracion`, `celebrar_album`, `celebrar_firma`, `celebrar_video`, `celebrar_plantilla` | Sí, aditivo: ampliar el `CHECK` de `entity_type`, los `case` de `media_assets_validar_entidad`, `media_puede_administrar_como` y `media_entidad_es_publica`, y `ENTIDADES`/`VISIBILIDAD_DE_ENTIDAD` en `src/lib/media/tipos.ts` |
| **IA** | `AIProvider` (`src/lib/ia/ai-provider.ts`), `claude-provider.ts`, `gemini-provider.ts`, `MODELOS` con precios, `configuracion_plataforma.ia_modelo_*`, `ia_tope_mensual_usd`, `motivoParaNoGastar()`, `registrarUsoIA()` → tabla `uso_ia` (tokens, `costo_usd`, `tipo_cambio` congelado, `costo_crc` generada, `usuario_id`, `referencia_id`) | Generación de textos/prompts y, cuando llegue, imágenes. Cada uso se registra en `uso_ia` con `agente = 'celebrar_*'` **y** se espeja en `celebrar_costos` con `uso_ia_id` | No para texto. Para video/imagen se crean proveedores nuevos detrás de interfaces propias (K) |
| **QR** | `qrcode` (ya se usa en pósters y mesas de Lealtad/Solutions) | Generar PNG/SVG en servidor para invitación, RSVP, álbum y firmas | No. **Evitar** `urlQr()` de `src/lib/qr.ts` (depende de api.qrserver.com, externo) |
| **Saneado de HTML** | `sanearHtmlInvitacion()` (`src/lib/invitaciones/sanear-html.ts`, con tests) | Solo para plantillas legado importadas como HTML. Las plantillas nuevas se renderizan desde JSON | No |
| **Retención** | `src/lib/invitaciones-retencion.ts` (6 meses invitación, 5 años álbum, `sumarMesesISO`) | Base para expiración/renovación de «Recuerdos» | No |
| **Dinero / países** | `src/lib/dinero.ts` (`formatearCRC/USD`), `paises.ts`, `monedas.ts` (21 países) | Precios en ₡ con formato local; monedas si se vende fuera de CR | No |
| **Analítica** | Patrón `visitas_pagina (entidad, dia, hash_visitante)` + `hashVisitante()` en `src/lib/visitas.ts`; `analytics-cloudflare.ts` | Copiar el patrón (no la tabla, que cuelga de `ranchos`) | No |
| **SEO / OG** | `opengraph-image.tsx` por ruta, `imagen-previa-negocio.tsx`, patrón «previa con la marca del negocio» | `/celebrar/[slug]/opengraph-image.tsx` con portada de la celebración | No |
| **Dominios** | `src/lib/solutions/dominios.ts` (host detection, `instruccionesDns`, `esHostPropio`) y el proxy | `src/lib/celebrar/dominios.ts` con las mismas funciones puras; `esHostPropio` debe reconocer `celebrar.lat` | Sí, mínimo: 1 línea en `esHostPropio` y un bloque en el proxy |
| **Slugs** | `RESERVED_SLUGS` en `src/lib/slug.ts` (evita que un negocio reclame `/celebrar`) | Agregar `celebrar` | Sí, 1 línea |
| **Infra de jobs** | `after()` (31 archivos), crons de Vercel/GitHub con `CRON_SECRET`, `maxDuration = 300` ya usado en `/api/invitaciones/generar-con-ia` | Cola `celebrar_trabajos` drenada por cron; nunca render pesado en el request | No |
| **Cuenta compartida** | `/cuenta` (tablero, `?volver=`, `?modo=`) | Un acceso «Ir a CELEBRAR» en la sección Invitaciones de `/cuenta` (opcional, decisión D-4) | Opcional |

---

## C. Qué debemos crear

Todo nuevo, con prefijo `celebrar_` en la base y carpeta `src/app/celebrar/`,
`src/lib/celebrar/`, `src/components/celebrar/` en el código.

- **Shell y marca**: layout propio (fuentes, tokens, nav, footer), landing,
  «cómo funciona», plantillas, precios, entrar.
- **Modelo**: celebraciones, invitaciones (invitación / save the date /
  recuerdos), plantillas + categorías + secciones + variantes, invitados, RSVP,
  álbumes, libro de firmas, mesa de regalos, QR, métricas.
- **Editor visual** con previa en vivo (iframe/`srcdoc` renderizado desde JSON
  de secciones; el patrón «previa = iframe del catálogo real» ya se usa en
  Linksy).
- **Créditos**: cuenta, movimientos (ledger inmutable), paquetes, tarifas por
  acción, pedidos de compra, RPC atómica de consumo.
- **Costos**: categorías, tarifas de proveedor, costos por celebración,
  rentabilidad.
- **Video**: tabla de videos + cola de trabajos + interfaces
  `VideoProvider` / `ImageProvider` con un primer proveedor «plantilla»
  (sin IA) y adaptadores IA después.
- **Admin CELEBRAR**: overview, usuarios, celebraciones, invitaciones,
  plantillas, créditos, pagos, costos, IA, videos, álbumes, métricas,
  configuración, auditoría.
- **Auditoría**: `celebrar_auditoria` append-only (no existe una bitácora
  genérica en Bookea; solo `bitacora_api_lealtad`, `bitacora_llaves` y la
  auditoría de dinero).
- **Configuración**: `celebrar_configuracion` clave→valor (proveedor IA, modelo,
  costos unitarios, tipo de cambio, límites) editable desde el admin.

---

## D. Tablas existentes relevantes

### D.1 El producto Invitaciones Digitales (hoy)

| Tabla | Migración | Columnas clave | Cómo se usa |
|---|---|---|---|
| `invitaciones` | 0066 (+0073, 0074, 0079, 0084, 0100…) | `slug` único, `cliente_id → auth.users`, `titulo, anfitriones, mensaje, fecha_evento, hora, lugar_nombre, direccion, maps_url, portada_url`, **`html_personalizado`**, `tema`, `estado (borrador|activa|archivada)`, `paleta jsonb`, `preguntas jsonb` (RSVP configurable), `imagenes_urls[]`, `videos_urls[]`, `audio_urls[]`, `config_ia jsonb`, `html_impresion`, `en_catalogo`, `es_ejemplo` | Lectura pública **solo por RPC** `invitacion_por_slug` / `invitacion_paleta_por_id` (security definer, anti-enumeración 0221→0223→0224). El dueño la ve por `cliente_id = auth.uid()`; **escribe el service role** desde server actions |
| `invitacion_rsvp` | 0066, 0070, 0088 | `nombre, acompanantes, asistira, mensaje` (+correo) | Insert anónimo si la invitación está activa (`invitacion_esta_activa`) |
| `pedidos_invitacion` | 0075, 0085 | paquete, `precio_usd/crc`, `monto_crc`, datos del evento, `metodo_pago (stripe|sinpe|transferencia)`, `comprobante_url`, `estado (pendiente_pago → en_revision → pagado → en_diseno → entregado | cancelado)`, `invitacion_id` | RPC `crear_pedido_invitacion()`; Stripe Checkout con `metadata.bookea_producto='invitacion'` |
| `paquetes_invitacion` | 0087 | `id text` (`basico, intermedio, plus, destello, celebracion, legado`), precios, `tiene_panel`, `activo`, `orden` | **El precio lo pone la base**, no TypeScript (`monto_paquete_crc()` con `configuracion_plataforma.tipo_cambio_usd`) — regla del repo |
| `albumes` | 0068, 0089, 0091 | `invitacion_id`, `cliente_id`, `slug`, `titulo`, `estado` | `/a/[slug]`; fotos en bucket Storage `albumes` |
| `album_fotos` | 0068 | `path` (Storage), `autor` | Subida por invitados; zip de descarga |
| `album_foto_llaves` | 0089 | llaves de borrado | |
| `uso_ia` | 0078 | `agente, modelo, tokens_*, costo_usd, tipo_cambio, costo_crc (generada), usuario_id, rancho_id, referencia_id` | Ledger de costos de IA de todo el sitio; panel `/admin/ia` |

Código asociado: `src/lib/catalogo-invitaciones.ts` (catálogo **hardcodeado**
de demos con `CATEGORIAS_INVITACIONES`), `src/lib/paquetes-invitaciones.ts`
(`TIPOS_EVENTO`, paquetes, productos individuales, promo), `src/lib/invitaciones/`
(`brief`, `paleta`, `pedido`, `sanear-html`), `src/lib/ia/generador-invitaciones.ts`
(chat libre → `<prompt_final>` → HTML), `docs/plantillas-invitaciones/*.html`
(plantillas fuente) y el agente `.claude/agents/disenador-invitaciones.md`.
La app móvil (`mobile/src/app/invitaciones/index.tsx`) **lee `invitaciones` y
`albumes`** con la llave anónima y abre `/i/{slug}`; «contratar, pedir y pagar»
viven solo en la web (regla 3.1.1 de Apple).

### D.2 Infraestructura compartida

| Tabla | Migración | Para qué le sirve a CELEBRAR |
|---|---|---|
| `perfiles` | 0008 (+roles) | Identidad y rol admin. **No se altera** (su `CHECK` de roles es compartido) |
| `media_assets`, `media_capacidades`, `media_rate_limit` | 0110–0115 | Toda la media de CELEBRAR (fotos, videos, audio, renders) |
| `eventos_stripe` | 0143 | Idempotencia del webhook (compartida) |
| `configuracion_plataforma` | 0009 (+ia_*) | Tipo de cambio y modelos IA globales; CELEBRAR lee, no escribe |
| `supresiones_correo`, `consentimientos` | 0082 | Correos a invitados sin violar bajas |
| `cobros_plataforma`, `libro-cobros.ts`, `auditoria-dinero.ts` | 0106 | Modelo de referencia para el libro de créditos |
| `transacciones_puntos`, `lealtad_transacciones` | 0060, 0197 | Precedente de **ledger con signo y `CHECK` por tipo** |
| `visitas_pagina` | 0107 | Patrón de métricas (hash por día) — se copia, no se reusa (cuelga de `ranchos`) |
| `solutions_*` | 0230–0241 | Precedente de producto con esquema propio, colaboradores, dominio propio y `diseno jsonb` |

Buckets de Storage existentes: `ranchos-fotos`, `comprobantes`, `solutions-fotos`,
`albumes`, `verificacion-proveedores`. **CELEBRAR no crea buckets de Supabase**:
todo va a R2/Cloudflare Images vía `media_assets` (los comprobantes de SINPE
también, con `entity_type='celebrar_pedido'`).

---

## E. Nuevas tablas propuestas

Convenciones: prefijo `celebrar_`, `uuid` pk, `created_at/updated_at`, RLS
habilitado en todas, `owner_id → auth.users on delete cascade` en las raíces,
`on delete set null` en referencias a media (una foto no muere con la cuenta),
índices por dueño/celebración, funciones `security definer` para lo público
(mismo patrón anti-enumeración de 0224). Numeración desde **0242**.

### E.1 Identidad y celebración

```
celebrar_perfiles
  id uuid pk → auth.users            nombre_publico, whatsapp, pais (iso2),
  moneda, acepta_marketing, onboarding jsonb, created_at, updated_at

celebrar_celebraciones
  id, owner_id → auth.users, tipo text check (boda|cumpleanos|xv|baby_shower|
  bautizo|graduacion|aniversario|despedida|fiesta|corporativo|otro),
  nombre, slug text unique (kebab, 3–60), fecha date, hora time, zona_horaria,
  lugar_nombre, direccion, maps_url, lat, lng, portada_asset_id → media_assets,
  descripcion, plantilla_id → celebrar_plantillas, plantilla_version int,
  tema jsonb (colores, fuentes, ajustes), config jsonb (módulos activos:
  rsvp, album, firmas, regalos, countdown…), estado text check
  (borrador|publicada|finalizada|recuerdos|archivada), publicada_en,
  expira_en, created_at, updated_at, deleted_at

celebrar_slugs
  slug text pk, celebracion_id → celebrar_celebraciones null,
  motivo text check (sistema|reservado|historico), created_at
  -- «sistema»: app, admin, api, entrar, plantillas, precios, como-funciona…
  -- «historico»: slugs viejos que redirigen al actual
```

### E.2 Plantillas

```
celebrar_plantilla_categorias  id text pk (elegante|minimalista|luxury|romantica|
  floral|moderna|editorial|tropical|infantil|fiesta|corporativa), nombre, orden, activa

celebrar_plantillas
  id, slug unique, nombre, categoria_id, nivel text check (gratis|premium|
  exclusiva|personalizada), costo_creditos int default 0, tipos_evento text[],
  preview_asset_id, portada_asset_id, version int, activa, orden, descripcion,
  esquema jsonb (secciones que admite y sus campos), estilos jsonb (tokens),
  html_legado text null (para las plantillas portadas de docs/plantillas-invitaciones),
  created_by, created_at, updated_at

celebrar_plantilla_secciones
  id, plantilla_id, tipo text (hero|historia|countdown|detalles|ubicacion|
  galeria|dress_code|rsvp|regalos|faq|mensaje|video|musica|firmas|album|custom),
  orden, obligatoria bool, contenido_default jsonb, opciones jsonb

celebrar_plantilla_variantes
  id, plantilla_id, nombre, tema jsonb (paleta/fuente alternativas),
  preview_asset_id, orden, activa
```

### E.3 Invitación, invitados y RSVP

```
celebrar_invitaciones
  id, celebracion_id, tipo text check (invitacion|save_the_date|recuerdos),
  contenido jsonb (secciones ordenadas con su contenido), musica_asset_id,
  video_id → celebrar_videos null, publicada bool, version int,
  render_cache text null, render_en, created_at, updated_at
  -- la fuente es la celebración; la invitación solo agrega diseño y copy

celebrar_invitados
  id, celebracion_id, nombre, email, telefono, grupo, mesa,
  max_acompanantes int, codigo text (unique por celebración; link personal),
  notas_internas, created_at, updated_at

celebrar_rsvp
  id, celebracion_id, invitado_id null, nombre, email, telefono,
  personas int, acompanantes jsonb (nombres), asistencia text check
  (pending|confirmed|declined), restricciones, notas, respuestas jsonb
  (preguntas configurables), origen text (link|qr|whatsapp), ip_hash,
  created_at, updated_at
  -- insert anónimo solo si la celebración está publicada (RPC)
```

### E.4 Álbum, firmas, regalos, QR

```
celebrar_albumes
  id, celebracion_id, titulo, privacidad text check (publico|con_codigo|privado),
  codigo_acceso, moderacion text check (auto|manual), limite_items int,
  permite_video bool, activo, created_at

celebrar_album_items
  id, album_id, media_asset_id → media_assets (entity_type='celebrar_album'),
  autor, mensaje, estado text check (pendiente|aprobado|oculto|eliminado),
  created_at, moderado_por, moderado_en

celebrar_firmas
  id, celebracion_id, nombre, mensaje, media_asset_id null,
  estado text check (pendiente|aprobada|oculta|eliminada), ip_hash, created_at

celebrar_regalos
  id, celebracion_id, tipo text check (enlace|banco|sinpe|lista|aporte|externo),
  titulo, descripcion, url, datos jsonb (iban, titular, sinpe…), orden, activo

celebrar_qr
  id, celebracion_id, destino text check (invitacion|rsvp|album|firmas|recuerdos),
  codigo text unique (corto, para /celebrar/q/<codigo>), created_at

celebrar_qr_escaneos
  qr_id, dia date, visitante_hash, dispositivo text, fuente text, n int
  pk (qr_id, dia, visitante_hash)
```

### E.5 Créditos (ledger)

```
celebrar_credito_cuentas
  id, owner_id unique → auth.users, saldo_cache int not null default 0,
  actualizado_en
  -- saldo_cache es CACHÉ: se recalcula desde movimientos; un job lo verifica

celebrar_credito_movimientos            -- INMUTABLE: sin update/delete (trigger)
  id, cuenta_id, tipo text check (compra|consumo|promocion|ajuste|reembolso|reverso),
  creditos int not null check (
    (tipo in ('compra','promocion','reembolso') and creditos > 0) or
    (tipo = 'consumo' and creditos < 0) or
    (tipo in ('ajuste','reverso') and creditos <> 0)),
  saldo_resultante int not null, concepto text, accion_id → celebrar_credito_acciones null,
  celebracion_id null, referencia_tipo text, referencia_id uuid,
  pedido_id → celebrar_pedidos null, registrado_por → auth.users null,
  metadata jsonb, created_at

celebrar_credito_paquetes
  id, nombre, creditos int, bonus_creditos int default 0, precio_crc int,
  precio_usd numeric(8,2), moneda text default 'CRC', activo, promocion jsonb
  (etiqueta, hasta), orden, descripcion, stripe_price_id null
  -- semilla: 100 / 300 / 700 / 1500; precios se editan en el admin

celebrar_credito_acciones               -- cuánto cuesta cada acción, configurable
  id text pk (publicar|plantilla_premium|animacion|video_plantilla|video_ia|
  imagen_ia|album_extra|almacenamiento_extra|recuerdos_renovacion…),
  nombre, creditos int, activa, descripcion, updated_at, updated_by

celebrar_pedidos                        -- compra de créditos
  id, owner_id, paquete_id, creditos int, monto_crc int, moneda,
  metodo_pago text check (stripe|sinpe|transferencia), estado text check
  (pendiente_pago|en_revision|pagado|cancelado|reembolsado),
  stripe_session_id unique null, comprobante_asset_id null, referencia_pago,
  pagado_en, revisado_por, created_at
```

RPCs (security definer, `set search_path = public`):

- `celebrar_consumir_creditos(p_accion, p_celebracion, p_referencia_tipo, p_referencia_id)`:
  `select … for update` sobre la cuenta, valida saldo ≥ costo, inserta el
  movimiento con `saldo_resultante`, actualiza `saldo_cache`. **Atómica**.
  Devuelve `{movimiento_id, saldo}`. Es la única forma de descontar.
- `celebrar_acreditar_pedido(p_pedido)`: idempotente (si ya hay movimiento con
  ese `pedido_id`, no repite).
- `celebrar_ajustar_creditos(p_cuenta, p_creditos, p_motivo)`: **solo admin**;
  exige motivo; escribe movimiento + fila en `celebrar_auditoria`.
- `celebrar_saldo(p_cuenta)`: `sum(creditos)` — para verificar el caché.

### E.6 Costos y rentabilidad

```
celebrar_costo_categorias  id text pk (ia_texto|ia_imagen|ia_video|almacenamiento|
  procesamiento|correo|sms|pasarela|multimedia|otros), nombre, activa

celebrar_costo_tarifas     -- lo que pide la sección 43: nada hardcodeado
  id, categoria_id, proveedor text, modelo text null, unidad text check
  (generacion|segundo|imagen|token_in|token_out|gb_mes|correo|pct_monto|fijo),
  costo_usd numeric(12,6), vigente_desde, vigente_hasta null, activa, notas

celebrar_costos
  id, celebracion_id null, invitacion_id null, video_id null, owner_id null,
  categoria_id, proveedor, accion text, cantidad numeric, unidad,
  costo_usd numeric(12,6), tipo_cambio numeric(10,2),
  costo_crc numeric(14,2) generated always as (round(costo_usd * tipo_cambio, 2)) stored,
  uso_ia_id → uso_ia null (puente con el ledger global de IA),
  media_asset_id null, pedido_id null, metadata jsonb, created_at
```

La rentabilidad por invitación (sección 12) es una **vista** sobre
`celebrar_pedidos` + `celebrar_credito_movimientos` + `celebrar_costos`:
ingreso atribuido (créditos consumidos × precio promedio pagado por esos
créditos) − costos. Se materializa por día para el dashboard.

### E.7 Video y trabajos

```
celebrar_videos
  id, celebracion_id, invitacion_id null, tipo text check (plantilla|ia|
  image_to_video|escenas|custom), proveedor text, modelo text null,
  parametros jsonb (fotos, música, textos, plantilla), estado text check
  (queued|processing|completed|failed|cancelled), duracion_s, resolucion,
  resultado_asset_id → media_assets null, poster_asset_id null,
  costo_usd, creditos_consumidos int, movimiento_id → celebrar_credito_movimientos,
  trabajo_id → celebrar_trabajos, iniciado_en, terminado_en, tiempo_ms,
  error text, intentos int, created_at

celebrar_trabajos                       -- cola genérica
  id, tipo text (render_video|generar_imagen|procesar_album|enviar_correos|
  recalcular_saldos|expirar_celebraciones), referencia_id uuid, payload jsonb,
  estado text check (pendiente|tomado|hecho|fallido|cancelado), intentos int,
  max_intentos int default 3, disponible_en timestamptz, tomado_en, tomado_por,
  terminado_en, error, created_at
```

### E.8 Métricas, auditoría, configuración

```
celebrar_metricas_eventos      -- crudo, se poda a 90 días
  id, celebracion_id, tipo text check (visita|rsvp|scan|foto|video_view|click|
  share|tiempo), dia date, visitante_hash, meta jsonb, created_at

celebrar_metricas_dia          -- agregado por job
  celebracion_id, dia, visitas, visitantes, rsvp, scans, fotos, video_views,
  clicks, shares, segundos_interaccion   pk (celebracion_id, dia)

celebrar_auditoria             -- append-only
  id, actor_id → auth.users null, actor_rol text, accion text, entidad text,
  entidad_id uuid, antes jsonb, despues jsonb, metadata jsonb, ip_hash, created_at

celebrar_configuracion         -- clave → valor
  clave text pk (ai_provider, ai_model_texto, ai_model_imagen, video_provider,
  tipo_cambio_override, limite_fotos_album, meses_retencion_recuerdos…),
  valor jsonb, descripcion, actualizado_por, actualizado_en
```

### E.9 Cambios aditivos en tablas compartidas (los únicos)

1. `media_assets.entity_type`: agregar `celebracion`, `celebrar_invitacion`,
   `celebrar_album`, `celebrar_firma`, `celebrar_video`, `celebrar_plantilla`,
   `celebrar_pedido` al `CHECK`, y sus ramas en `media_assets_validar_entidad`,
   `media_puede_administrar_como` y `media_entidad_es_publica` (0111).
   `create or replace` — sin borrar nada.
2. Nada más. `perfiles`, `invitaciones`, `albumes`, `configuracion_plataforma`,
   `uso_ia` **no se alteran**.

### E.10 RLS (resumen)

- Dueño: `owner_id = auth.uid()` en `celebrar_celebraciones`; las hijas heredan
  vía `exists (select 1 from celebrar_celebraciones c where c.id = celebracion_id and c.owner_id = auth.uid())`
  (función `celebrar_es_duena(p_celebracion)` como `solutions_es_del_equipo`).
- Público: **cero `select` directo** para `anon` en celebraciones/invitaciones;
  se lee por `celebrar_publica_por_slug(slug)` (security definer, solo
  `estado in ('publicada','recuerdos')`, sin devolver email/teléfono de nadie).
  Es la lección de 0221/0223/0224.
- Invitados: `insert` en `celebrar_rsvp` y `celebrar_firmas` solo por RPC que
  verifica publicación + rate limit por `ip_hash`; fotos por capacidad anónima
  de `media_assets`.
- Admin: `is_admin()` para `select` global y para `celebrar_ajustar_creditos`.
- Ledger y auditoría: `insert` solo por RPC; **sin políticas de update/delete**
  y trigger `raise exception` por si el service role se equivoca.
- Créditos y costos: el dueño ve sus movimientos y su saldo; **nunca ve
  `celebrar_costos`** (costos internos, sección 37).

---

## F. Estrategia de autenticación

- **Una sola cuenta**: la de Supabase Auth de Bookea. `/celebrar/entrar` reusa
  `FormularioAuth` con `destino="/celebrar/app"` (idéntico a `/linksy/login`).
  El callback `/auth/callback?next=/celebrar/app` ya valida rutas internas.
- **Perfil propio**: `celebrar_perfiles` se crea la primera vez que el usuario
  entra a `/celebrar/app` (upsert). No se toca `perfiles`.
- **Sesión en el servidor**: `usuarioActual()` (cacheado por request) en cada
  página de `/celebrar/app/*`; sin sesión → `redirect('/celebrar/entrar?next=…')`.
  No hace falta agregar `/celebrar/app` a la guardia del proxy (las páginas ya
  lo hacen), pero **sí `/celebrar/admin`** para heredar la revisión de rol.
- **Admin**: `requireAdmin()` + `is_admin()`. No se inventa un rol nuevo (el
  `CHECK` de `perfiles.rol` es compartido y la app móvil lo lee).
- **Cuando exista `celebrar.lat`** (sección P): la cookie de Supabase nace sin
  `domain`, así que **no cruza de `bookea.lat` a `celebrar.lat`**. Dos caminos:
  - **P-A (recomendado)**: login completo en `celebrar.lat`. Requiere agregar
    `https://celebrar.lat/auth/callback` (y `www`) a *Redirect URLs* de
    Supabase Auth y dejar pasar `/auth/*` en el proxy para ese host. El
    usuario inicia sesión una vez por dominio con la **misma cuenta**. Cumple
    «estoy en celebrar.lat».
  - **P-B (como Linksy)**: público en `celebrar.lat`, mundo con sesión en
    `bookea.lat/celebrar/app`. Menos trabajo, pero el usuario «sale» a Bookea.

---

## G. Estrategia de routing

### G.1 Árbol de rutas (`src/app/celebrar/`)

```
celebrar/
  layout.tsx                 shell propio: fuentes, tokens .celebrar, <NavCelebrar/>, <PieCelebrar/>,
                             metadata { title: { template: "%s | CELEBRAR" } }
  page.tsx                   landing (hero, características, tipos, video IA, cómo funciona, precios)
  como-funciona/  plantillas/  precios/  entrar/
  app/                       dashboard del cliente (requiere sesión)
    layout.tsx               menú lateral: Inicio, Mis celebraciones, Crear, Plantillas,
                             Mis créditos, Álbumes, Videos, Invitados, RSVP, Configuración
    page.tsx  celebraciones/  crear/ (wizard 7 pasos)  plantillas/  creditos/
    albumes/  videos/  invitados/  configuracion/
    celebraciones/[id]/      editor, invitados, rsvp, album, firmas, regalos, qr, metricas, video
  admin/                     admin CELEBRAR (requireAdmin)
    overview, usuarios, celebraciones, invitaciones, plantillas, creditos, pagos,
    costos, ia, videos, albumes, metricas, configuracion, auditoria
  q/[codigo]/route.ts        QR corto → registra escaneo → redirige al destino
  [slug]/                    PÚBLICO: la invitación (force-static + revalidate, como /i)
    page.tsx  opengraph-image.tsx
    rsvp/  album/  firmas/  recuerdos/  save-the-date/
api/celebrar/                rsvp, firmas, metricas (beacon), stripe (solo si se opta por
                             endpoint propio), trabajos/tick (cron)
```

`/celebrar/[slug]` convive con los segmentos estáticos (`app`, `admin`, `q`,
`plantillas`…) porque Next resuelve estáticos antes que dinámicos; **los nombres
de esos segmentos se siembran en `celebrar_slugs` con `motivo='sistema'`** para
que nadie pueda reclamarlos (el mismo truco que `RUTAS_LINKSY` /
`PREFIJOS_BOOKEA`).

### G.2 Detección de contexto

`src/lib/celebrar/dominios.ts` (funciones puras + tests, copia del patrón de
Solutions):

```ts
CELEBRAR_HOST = "celebrar.lat"
esHostCelebrar(host)                       // celebrar.lat | www.celebrar.lat
destinoEnCelebrar(pathname): Destino       // "/" → rewrite /celebrar
                                           // "/app/..." → rewrite /celebrar/app/...
                                           // "/<slug>" → rewrite /celebrar/<slug>
                                           // "/auth/*", "/api/*", "/_next/*" → pasar
                                           // "/celebrar/..." → redirect sin prefijo (canónico)
urlPublicaCelebracion(slug)                // NEXT_PUBLIC_CELEBRAR_URL ? `${url}/${slug}`
                                           //                         : `${SITIO}/celebrar/${slug}`
```

En `src/proxy.ts` se agrega **un bloque** antes del de Linksy, con la misma
forma. En `esHostPropio` se agrega `celebrar.lat` para que ningún negocio de
Solutions pueda reclamarlo como dominio (misma defensa que con Linksy).

### G.3 Lo que hay que tocar en Bookea (mínimo y aditivo)

| Archivo | Cambio | Riesgo |
|---|---|---|
| `src/proxy.ts` | bloque `esHostCelebrar` + `/celebrar/admin` en `isAdminRoute` | bajo; funciones puras probadas aparte |
| `src/lib/solutions/dominios.ts` | `esHostPropio` reconoce `celebrar.lat` | nulo |
| `src/lib/slug.ts` | `RESERVED_SLUGS` += `celebrar` | nulo |
| `src/components/chat-flotante.tsx` | `if (pathname.startsWith("/celebrar")) return null` (o lista `RUTAS_SIN_BURBUJA`) | nulo |
| `src/lib/pagos/suscripciones.ts` | ramificar `mode === "payment"` por `metadata.bookea_producto` | bajo; hoy el producto desconocido cae en `ignorado`; se agrega test |
| `src/app/sitemap.ts` / `robots.ts` | incluir celebraciones publicadas | nulo |
| `src/lib/media/tipos.ts` + migración | entidades nuevas | medio; funciones SQL compartidas, `create or replace` |

Todo lo demás es nuevo.

---

## H. Estrategia Vercel

- **Mismo proyecto `aventurar-cr`**. La memoria del proyecto es clara: la
  factura la mueven la cantidad de proyectos de Supabase/Vercel y la cantidad
  de builds (~5,7 CPU-min cada uno), no el tráfico. Un proyecto nuevo sería
  costo puro y rompería el «una sola sesión». CELEBRAR es rutas + un host más
  en el mismo deployment, igual que Linksy.
- **Dominio** (cuando exista): `vercel domains add celebrar.lat` +
  `www.celebrar.lat` al mismo proyecto; DNS en Namecheap con las instrucciones
  que ya genera `instruccionesDns()` (A `76.76.21.21` para el apex, CNAME
  `cname.vercel-dns.com` para `www`). SSL lo emite Vercel.
- **Variables**: `NEXT_PUBLIC_CELEBRAR_URL` (vacía hasta el estreno). Opcionales:
  `RESEND_FROM_EMAIL_CELEBRAR`, y las de proveedores de video/imagen cuando
  se conecten.
- **Funciones**: nada pesado en el request. Los trabajos se drenan con un cron
  (`/api/celebrar/trabajos/tick`, `maxDuration` acotado) o con GitHub Actions
  como ya hace Lealtad; los proveedores de video que sean asíncronos avisan por
  webhook.
- **Crons**: máximo 1 más en `vercel.json` (`trabajos/tick`) — o en GitHub
  Actions para no tocar `vercel.json` (regla del repo: pedir confirmación antes).
- **Congelamiento**: nada de esto se despliega hasta que el dueño diga «subilo».
  Se desarrolla y prueba en `localhost:3100`.

---

## I. Estrategia Supabase

- **Mismo proyecto** (`bjhprmtobmualefvcmau`). Tres proyectos de Supabase ya
  pesan en la factura; no se crea uno más.
- **Migraciones** `0242_celebrar_base.sql` en adelante, en tandas por fase:
  - 0242 identidad + celebraciones + slugs + plantillas (+ categorías,
    secciones, variantes) + semillas de categorías y slugs de sistema.
  - 0243 invitaciones + invitados + RSVP + RPC públicas.
  - 0244 créditos (cuentas, movimientos, paquetes, acciones, pedidos, RPCs,
    trigger de inmutabilidad) + semillas de paquetes y acciones.
  - 0245 costos (categorías, tarifas, costos) + vista de rentabilidad.
  - 0246 álbumes, firmas, regalos, QR + entidades nuevas en `media_assets`.
  - 0247 videos + trabajos.
  - 0248 métricas + auditoría + configuración.
- **Reglas**: `create table if not exists` solo donde es seguro; RLS en todas;
  `grant` explícitos a `anon`/`authenticated` solo de lo necesario; funciones
  `security definer` con `set search_path = public`; comentarios en español
  como el resto del repo; ninguna migración toca datos existentes.
- **Orden respecto al código**: como las tablas son nuevas, el orden
  «migración antes del deploy» es seguro. La única migración que altera algo
  compartido (entidades de `media_assets`) también es segura antes del deploy
  porque solo **amplía** listas.
- **Aplicación**: `supabase db push --linked` (memoria: el historial remoto
  ya está reparado). Recordar que 0239 y 0240 están pendientes y van primero.
- **Móvil**: la app no toca `celebrar_*`. Ver riesgo R-8 para la paridad.

---

## J. Estrategia Cloudflare / R2

Ya está construido y probado (memoria: «Cloudflare ya está construido pero solo
lo usa una pantalla»). CELEBRAR sería su segundo gran consumidor.

| Necesidad | Cómo |
|---|---|
| Fotos de portada, galería, plantillas | `media_assets` con `visibilidad='publica'`, entrega por `imagedelivery.net` con variantes `thumb/card/gallery/hero` (ya en `remotePatterns` de `next.config.ts`) |
| Fotos que suben invitados al álbum | `media_emitir_capacidad` → `/api/media/sesion-anonima` → subida directa a R2 → `/api/media/confirmar`. Turnstile ya integrado (`TURNSTILE_SECRET_KEY`, con `MEDIA_TURNSTILE_BYPASS` para local). Cuotas por álbum reutilizadas (`cuotas.ts`) |
| Videos (subidos y renders) | R2 (`R2_BUCKET_ORIGINALS`) con `mime video/*` ≤ 100 MB (ya permitido). **Entrega**: R2 con URL firmada o pública + `<video>` progresivo para el MVP. Cloudflare Images **no sirve video**; Cloudflare Stream (HLS, thumbnails) no está integrado — decisión D-6 |
| Audio (música de la invitación) | R2, `audio/*` ≤ 20 MB (ya permitido) |
| Comprobantes SINPE | `media_assets` `entity_type='celebrar_pedido'`, privado |
| Costos de almacenamiento | `src/lib/media/precios.ts` ya modela R2 (GB-mes, clase A/B, egress 0) y Cloudflare Images; `celebrar_costos` registra por celebración con `categoria='almacenamiento'` a partir de `media_uso_por_entidad` |
| Analítica | `analytics-cloudflare.ts` para el agregado de entrega |

No se guarda ningún binario en Postgres; `media_assets` guarda solo metadatos.

---

## K. Estrategia de videos

### K.1 Interfaces (`src/lib/celebrar/proveedores/`)

```ts
interface VideoProvider {
  id: string;                                   // "plantilla-local" | "runway" | "veo" | …
  capacidades: ("plantilla" | "ia" | "image_to_video" | "escenas")[];
  estimarCosto(p: ParametrosVideo): Promise<{ usd: number; segundos: number }>;
  encolar(p: ParametrosVideo): Promise<{ trabajoExterno: string } | { inmediato: ResultadoVideo }>;
  consultar(trabajoExterno: string): Promise<EstadoVideo>;      // polling
  recibirWebhook?(req: Request): Promise<EstadoVideo | null>;   // push
}
interface ImageProvider { generar(p): Promise<…>; estimarCosto(p): … }
```

`AIProvider` (texto) ya existe; `EmailProvider`, `PaymentProvider` y
`StorageProvider` se cubren con envoltorios finos sobre `enviarCorreo`,
`stripeDelEntorno`/SINPE y `media_assets` — no se reescriben.

### K.2 Fase 1 del video: plantilla, sin IA, barato

Fotos + datos + plantilla + música → MP4. Dos opciones viables sin levantar
infraestructura:

1. **Render en el navegador del cliente** (Canvas/WebCodecs → MP4 vía
   `mediabunny`/`webm` → subir a R2 como cualquier asset). Costo de cómputo
   cero para nosotros; limitado por el dispositivo. Bueno para 15–30 s.
2. **Render en servidor con FFmpeg** en un worker externo (GitHub Actions
   por trabajo, o un contenedor chico) que toma trabajos de `celebrar_trabajos`
   y sube el resultado a R2. Vercel no es el lugar (Fluid cobra CPU activa y
   `maxDuration` limita).

Recomiendo **1 para el MVP y 2 como camino de calidad**. Las dos escriben
`celebrar_videos` + `celebrar_costos` igual.

### K.3 Fase 2: IA

Adaptadores `image_to_video` (Veo vía `@google/genai` que ya está en el
`package.json`, u otro) detrás de `VideoProvider`. Costos por segundo/imagen
en `celebrar_costo_tarifas`; créditos por acción en `celebrar_credito_acciones`.
El consumo de créditos se hace **al encolar** (`celebrar_consumir_creditos`) y
se **revierte** (`tipo='reverso'`) si el trabajo termina en `failed`.

### K.4 Ciclo

`queued → processing → completed | failed | cancelled` en `celebrar_videos`;
la cola `celebrar_trabajos` tiene `intentos`, `disponible_en` (backoff) y
`tomado_por` (lease). Un `tick` cada N minutos (cron) toma lo pendiente. Nada
de render dentro de un request de Next.

---

## L. Sistema de créditos

- **Ledger primero, saldo después.** `celebrar_credito_movimientos` es la
  verdad; `saldo_cache` en la cuenta es una optimización que un job
  (`recalcular_saldos`) verifica contra `sum(creditos)` y, si difiere, escribe
  en `celebrar_auditoria` y corrige.
- **Todo movimiento tiene concepto y referencia**: `accion_id`
  (`publicar`, `video_ia`…), `celebracion_id`, `referencia_tipo/id`, `pedido_id`.
  Es lo que permite el texto de la sección 34 («Generar video · 100 créditos ·
  saldo 350 → 250») **antes** de confirmar y el historial después.
- **Consumo atómico** por RPC con bloqueo de fila; el cliente nunca escribe el
  ledger.
- **Compra**: `celebrar_pedidos` → Stripe Checkout (`bookea_producto='celebrar_creditos'`)
  o SINPE con comprobante → al confirmar, `celebrar_acreditar_pedido` (idempotente).
- **Promocionales, ajustes y reembolsos**: solo admin, con motivo, y quedan
  también en `celebrar_auditoria`.
- **Precios configurables**: paquetes y acciones en tablas, editables desde
  `/celebrar/admin/creditos`; **el precio del pedido lo pone la base** (misma
  regla que `monto_paquete_crc` en Bookea).
- **UI del cliente**: «Créditos disponibles» siempre visible en el shell del
  dashboard; cada acción que consume muestra costo, saldo actual y saldo
  posterior antes del botón.

---

## M. Sistema de costos

- Cada acción con costo real escribe **una fila en `celebrar_costos`** con
  `categoria_id`, `proveedor`, `cantidad`, `unidad`, `costo_usd` y
  `tipo_cambio` congelado (patrón de `uso_ia`). Cuando la fuente es la IA de
  texto, la fila apunta al `uso_ia_id` para no duplicar la verdad.
- **Tarifas configurables** en `celebrar_costo_tarifas` (por proveedor, modelo,
  unidad, vigencia). El código pide «¿cuánto cuesta un segundo de video con el
  proveedor X hoy?» a una función `tarifaVigente(categoria, proveedor, unidad)`,
  nunca a una constante.
- **Almacenamiento**: un job mensual reparte el costo de R2/Cloudflare por
  celebración usando `media_uso_por_entidad` y `src/lib/media/precios.ts`.
- **Pasarela**: al acreditar un pedido Stripe se registra el fee real (o el
  % configurado) como `categoria='pasarela'` contra el pedido, y se prorratea
  a las celebraciones cuando consumen esos créditos (o se deja a nivel de
  usuario — decisión de producto, D-7).
- **Correos**: costo unitario configurable por correo enviado a invitados.
- **Rentabilidad** (secciones 12–14): vista `celebrar_rentabilidad_celebracion`
  y agregado diario `celebrar_finanzas_dia` (ingresos, costos, margen, ARPU,
  ticket, costo/invitación, créditos vendidos/consumidos/pendientes). Los
  filtros (hoy/7/30/mes/trimestre/año/rango) son sobre el agregado.

---

## N. Dashboard administrativo

- Ruta `/celebrar/admin/*`, **shell propio** (no el rail de `/admin`), acceso
  por `requireAdmin()`. Estética formal de CELEBRAR (verde oscuro/crema), no la
  navy de Bookea.
- Secciones: Overview, Usuarios, Celebraciones, Invitaciones (tabla con
  precio/créditos/costo/margen/visitas/RSVP/álbum), Plantillas (CRUD, duplicar,
  premium, categoría, costo en créditos, preview, versión), Créditos (saldos,
  compras, consumo, ajustes con motivo, anomalías), Pagos, Costos (tarifas y
  detalle), IA, Videos (cola y fallos), Álbumes (moderación global), Métricas,
  Configuración (`celebrar_configuracion`), Auditoría.
- Las **escrituras** administrativas van por server actions que envuelven
  `requireAdmin()` y escriben `celebrar_auditoria` (quién, qué, cuándo, antes,
  después).
- **Puente con Bookea**: un ítem «CELEBRAR →» en `secciones-admin.ts` del admin
  actual (1 línea, opcional) para que el equipo lo encuentre; nada más.

---

## O. Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R-1 | **Dos productos de invitaciones conviviendo** (`/invitaciones` + `/i` vs `/celebrar`) confunden al cliente y al equipo | comercial | Decisión D-1. Propuesta: CELEBRAR nace aparte; cuando tenga paridad, `/invitaciones` redirige a `/celebrar` y `/i/{slug}` sigue sirviendo lo ya vendido (legado) |
| R-2 | El rediseño de `/invitaciones` **sin commit** en el árbol | pisar trabajo ajeno | CELEBRAR no toca `src/app/invitaciones/*` ni `src/lib/paquetes-invitaciones.ts`. Antes de cualquier commit, revisar `git status` |
| R-3 | `bookea.app` no existe | URLs y OG rotos | Usar `bookea.lat/celebrar`; confirmar con el dueño |
| R-4 | Webhook de Stripe: `mode=payment` asume invitación → hoy una compra de créditos sería **cobrada e ignorada** | dinero | Ramificar por `bookea_producto` **antes** de vender; test del despachador; revisar `eventos_stripe` en el admin |
| R-5 | Burbuja `ChatFlotante` global aparece en CELEBRAR | marca | 1 línea de exclusión por ruta |
| R-6 | Cookie de sesión no cruza apex → «una sola cuenta» no es «una sola sesión» entre dominios | UX en el estreno | P-A: login en `celebrar.lat` con las mismas credenciales (Supabase redirect URLs) |
| R-7 | Funciones SQL de `media_assets` compartidas se **reemplazan** para agregar entidades | regresión en fotos de negocios | `create or replace` que **solo agrega ramas**; correr `src/lib/media/*.test.ts`; probar subida en `/mi-negocio` y `/a/[slug]` en local |
| R-8 | App móvil: Apple 3.1.1 prohíbe vender contenido digital en la app; además lee `invitaciones`/`albumes` | paridad web-móvil (regla del repo) | CELEBRAR web-first; la app puede **mostrar** celebraciones y RSVP (lectura) sin vender créditos; anotarlo como excepción explícita. No alterar `invitaciones`/`albumes` |
| R-9 | Video pesado en Vercel (Fluid cobra CPU activa; `maxDuration`) | costo/timeouts | Render en cliente o worker externo; cola `celebrar_trabajos` |
| R-10 | Entrega de video sin CDN de video (Cloudflare Images no sirve MP4) | rendimiento móvil desde WhatsApp | MVP: MP4 corto (≤30 s, ≤10 MB) desde R2 con `preload="metadata"` y póster por Cloudflare Images; evaluar Stream después (D-6) |
| R-11 | Plantillas actuales son **HTML libre saneado** (`html_personalizado`); el editor visual necesita **estructura** | reescritura de plantillas | Plantillas nuevas = JSON de secciones + render React; las legado se portan con `html_legado` y se muestran sin editor (solo datos), marcadas `nivel='exclusiva'` |
| R-12 | Enumeración de datos personales por `select` anónimo (ya pasó con `invitaciones`, 0221–0224) | privacidad | Cero `select` anónimo; RPC por slug que devuelve solo lo público |
| R-13 | Un negocio del marketplace reclama el slug `celebrar` o un cliente reclama `app`/`admin` en CELEBRAR | rutas muertas | `RESERVED_SLUGS` + `celebrar_slugs` de sistema, con test |
| R-14 | `saldo_cache` desincronizado | créditos fantasma | Job de verificación + la RPC de consumo recalcula con `for update` |
| R-15 | Migraciones pendientes 0239/0240 y numeración | historial remoto roto otra vez | Aplicar 0239/0240 primero; CELEBRAR desde 0242; nunca renumerar |
| R-16 | Costo de builds (~5,7 CPU-min c/u) | factura | Trabajo por tandas en local; un deploy por fase |
| R-17 | `configuracion_plataforma.tipo_cambio_usd` es global | precios en ₡ de CELEBRAR atados a Bookea | Se lee de ahí por defecto; `celebrar_configuracion.tipo_cambio_override` si hace falta |
| R-18 | Correos a invitados sin consentimiento previo | reputación del remitente Resend | Transaccionales solo (confirmación RSVP, recordatorio pedido por el anfitrión); respetar `supresiones_correo`; remitente propio |

---

## P. Plan de migración futura a `celebrar.lat`

Nada de esto se ejecuta ahora. Cuando el dominio exista:

1. **Código ya desplegado** con `esHostCelebrar` en el proxy y
   `NEXT_PUBLIC_CELEBRAR_URL` **vacía** (todo sigue en `bookea.lat/celebrar`).
2. **Vercel**: `vercel domains add celebrar.lat` y `www.celebrar.lat` al proyecto
   `aventurar-cr`. Decidir canónico (`celebrar.lat` sin `www`, coherente con
   `linksy.lat`) y dejar que Vercel redirija el otro.
3. **DNS (Namecheap)**: A `@ → 76.76.21.21`, CNAME `www → cname.vercel-dns.com`
   (lo que devuelve `instruccionesDns("celebrar.lat")`). Esperar SSL.
4. **Supabase Auth**: agregar `https://celebrar.lat/auth/callback` y
   `https://www.celebrar.lat/auth/callback` a *Redirect URLs* (para P-A).
5. **Variables**: `NEXT_PUBLIC_CELEBRAR_URL=https://celebrar.lat` en Vercel →
   redeploy. Desde ese momento links, QR y OG usan el dominio nuevo.
6. **Canónicos y SEO**: `metadataBase` del layout de CELEBRAR pasa a
   `celebrar.lat`; `bookea.lat/celebrar/*` responde `301` a `celebrar.lat/*`
   (una condición en el proxy: host Bookea + prefijo `/celebrar` + variable
   puesta → redirect). Sitemap propio en `celebrar.lat/sitemap.xml`
   (rewrite a `/celebrar/sitemap.xml`).
7. **QR ya impresos**: siguen funcionando porque `bookea.lat/celebrar/q/<codigo>`
   redirige.
8. **Alias**: tras el deploy por CLI, re-aliasear los dominios al deployment
   correcto (lección de la memoria).
9. **Verificar** con `curl -I` contra `celebrar.lat/`, `/maria-y-juan`, `/app`,
   `/auth/callback`.

Lo único que cambia en el código entre «antes» y «después» es una variable de
entorno y un `301`. No hay reconstrucción.

---

## Q. Plan de implementación por fases

Cada fase termina con `npm run lint`, `npx tsc --noEmit`, `npm test` y
`npm run build` en verde, y **sin commit ni deploy** salvo pedido explícito.

| Fase | Entregable | Migraciones | Toques a Bookea |
|---|---|---|---|
| **0 Auditoría** | este documento + `architecture.md` | — | — |
| **1 Shell** | `src/app/celebrar/{layout,page}.tsx`, nav, footer, tokens `.celebrar`, landing completa (hero, características, tipos, video IA, cómo funciona, precios), `como-funciona`, `precios`, `plantillas` (estático), responsive, OG propio | — | `RESERVED_SLUGS`, exclusión del `ChatFlotante` |
| **2 Auth + dashboard** | `/celebrar/entrar`, `/celebrar/app` (shell con menú), `celebrar_perfiles`, lista y cards de celebraciones, wizard «crear» (pasos 1–2) | 0242 | — |
| **3 Invitaciones** | plantillas (catálogo desde la base + porte de 3–4 plantillas legado), editor con previa en vivo, publicación, slug, `/celebrar/[slug]` público con OG, save the date | 0242–0243 | proxy (host), sitemap |
| **4 Créditos** | ledger, paquetes, acciones, `/celebrar/app/creditos`, compra Stripe/SINPE, consumo visible por acción, admin de créditos | 0244 | `suscripciones.ts` (despacho por producto) |
| **5 Costos** | `celebrar_costos`, tarifas, registro desde IA/media/pasarela, vista de rentabilidad, `/celebrar/admin/costos` y overview financiero | 0245 | — |
| **6 RSVP + álbum** | invitados (CSV), RSVP público + panel, QR (`/celebrar/q`), álbum con subida anónima por capacidad, moderación, libro de firmas, mesa de regalos | 0246 | `media_assets` (entidades) |
| **7 Video** | `VideoProvider`, proveedor «plantilla» (render en cliente), cola de trabajos, `celebrar_videos`, UI de generación con costo en créditos; adaptador IA detrás de bandera | 0247 | — |
| **8 Admin completo** | resto de secciones, métricas, auditoría, configuración | 0248 | ítem en `secciones-admin.ts` (opcional) |
| **9 Domain ready** | `dominios.ts` + tests, bloque del proxy, `NEXT_PUBLIC_CELEBRAR_URL`, doc de estreno | — | proxy, `esHostPropio` |

Pruebas mínimas por fase (Vitest, sin red): funciones puras de dominios y
slugs; saneado y render de secciones; **ledger** (signo por tipo, saldo
resultante, idempotencia de acreditación, reverso); cálculo de costos y
rentabilidad; despacho de Stripe por producto; reglas de RSVP; permisos
(`celebrar_es_duena`) con SQL de prueba en `docs/celebrar/`.

---

## Decisiones que necesito del dueño antes de la Fase 1

- **D-1 · Relación con Invitaciones Digitales.** Recomiendo **esquema propio
  `celebrar_*` + puentes**, dejando `/invitaciones` y `/i/{slug}` intactos
  como legado hasta que CELEBRAR tenga paridad; entonces `/invitaciones` →
  `/celebrar` (301) y las invitaciones vendidas siguen vivas en `/i`.
  Alternativa: extender las tablas actuales (menos tablas, pero arrastra el
  modelo «HTML a la medida», toca lo que lee la app móvil y mezcla dos
  productos en un admin). ¿Vamos con la recomendación?
- **D-2 · Dominio temporal.** `bookea.lat/celebrar` (lo que existe) — ¿o hay
  un `bookea.app` que deba agregar al proyecto?
- **D-3 · Sesión en `celebrar.lat`.** P-A (login completo en celebrar.lat) o
  P-B (como Linksy, panel en bookea.lat). Recomiendo P-A.
- **D-4 · Puertas desde Bookea.** ¿Un link «CELEBRAR» en `/cuenta` (sección
  Invitaciones) y en el admin? Recomiendo sí, discreto, sin mezclar navegación.
- **D-5 · Plantillas legado.** ¿Portar las demos actuales
  (`docs/plantillas-invitaciones/`, catálogo) como plantillas `exclusiva` sin
  editor, o arrancar el catálogo de CELEBRAR de cero con 3–4 plantillas
  estructuradas? Recomiendo **ambas**: 3 nuevas editables + las legado como
  vitrina.
- **D-6 · Video.** MVP con render en el navegador (gratis, ≤30 s) y evaluar
  Cloudflare Stream/worker FFmpeg después. ¿De acuerdo?
- **D-7 · Atribución de la comisión de pasarela.** ¿Al usuario (cuando compra)
  o prorrateada a la celebración (cuando consume)? Recomiendo al usuario, con
  el prorrateo como columna calculada del reporte.
- **D-8 · Paridad móvil.** Aceptar que CELEBRAR es web-first y que la app, si
  algo muestra, es solo lectura (Apple 3.1.1). Queda anotado como excepción.

Con D-1, D-2 y D-3 respondidas arranco la Fase 1 en local.
