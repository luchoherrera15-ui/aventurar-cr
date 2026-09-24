# CELEBRAR — Arquitectura

> Resumen ejecutivo de [audit.md](./audit.md). Este archivo dice **qué se
> reutiliza, qué se crea y qué puede romperse**; el detalle de tablas, RLS,
> rutas y fases está en la auditoría.
>
> Estado (21 sep 2026): D-1, D-2 y D-3 **aprobadas**. Fase 1 hecha en local —
> shell, portada, acceso, panel y arquitectura de dominio; ver
> [fase-1.md](./fase-1.md). Fase 2 hecha — asistente, lista, ficha, perfil;
> **0242 aplicada**; ver [fase-2.md](./fase-2.md). Fase 3 hecha — 440
> plantillas sembradas, editor en vivo, IA (sin cobro todavía), publicar y
> página pública; **0243 aplicada**; ver [fase-3.md](./fase-3.md). Fase 3b —
> las invitaciones al estándar de las demos de Bookea (escenas, ornamentos,
> fondos vivos, editor por secciones tipo fiestly) y carrusel con fotos en
> la portada; ver [fase-3b-rediseno.md](./fase-3b-rediseno.md). Fase 3c — la
> demo viva del héroe (invitación real que baja sola, con formulario de
> confirmación), **música** (bucket `celebrar-media`, **0244 aplicada**) y el
> catálogo por estilos con ~40 diseños cada uno, todo gratis (se cobra al
> publicar); ver [fase-3c-demo-musica-catalogo.md](./fase-3c-demo-musica-catalogo.md).
> Fases 4 y 6 (v1) — monedero de créditos (publicar cuesta 80/120), RSVP
> configurable en la página + panel Invitados con CSV, IA con enfriamiento
> y costo real, edición de textos en el teléfono y motivos a media voz;
> **0245 aplicada**; ver [fase-4-6-creditos-invitados.md](./fase-4-6-creditos-invitados.md).
> Fase 5 (v1) — Stripe Checkout conectado a los créditos (webhook + vuelta
> verificada), balance, admin de créditos, programa de PARTNERS (mayorista,
> firma, plantillas de la casa, directorio) y la invitación como pieza centrada
> en escritorio; **0246 y 0247 aplicadas**; ver [fase-5-stripe-admin-partners.md](./fase-5-stripe-admin-partners.md).
> Fase 5b — «Ver demos» (7 invitaciones de muestra, álbum y panel de
> muestra), bots de IA con precio fijo (Chispa/Musa/Maestra) y el cuadro de
> IA en portal; **0248 aplicada**; ver [fase-5b-demos-bots-ia.md](./fase-5b-demos-bots-ia.md).
> Todo en local, sin commit ni deploy.

## La idea en una figura

```
                         UN SOLO REPO · UN PROYECTO DE VERCEL · UN PROYECTO DE SUPABASE
 ┌───────────────────────────────────────────────────────────────────────────────────────┐
 │ src/proxy.ts  ── host bookea.lat ──────────▶ rutas de Bookea (+ /celebrar/*)           │
 │               ── host linksy.lat ──────────▶ rewrite a /linksy, /s/<slug>   (ya existe) │
 │               ── host celebrar.lat (futuro) ▶ rewrite a /celebrar, /celebrar/<slug>    │
 └───────────────────────────────────────────────────────────────────────────────────────┘
          │                                   │                                 │
   BOOKEA (marketplace)              LINKSY / SOLUTIONS                 CELEBRAR
   src/app/{page,[slug],cuenta,      src/app/{solutions,linksy,s}       src/app/celebrar/**
   mi-negocio,admin,lealtad,…}       tablas solutions_*                 src/lib/celebrar/**
   tablas ranchos, reservas, …                                          tablas celebrar_*
          │                                   │                                 │
          └──────────────── infraestructura compartida (sin duplicar) ──────────┘
     Supabase Auth + perfiles · media_assets (R2 + Cloudflare Images) · Stripe + eventos_stripe
     Resend · AIProvider + uso_ia · configuracion_plataforma (tipo de cambio, modelos)
```

Principio: **CELEBRAR comparte tubería, no tablas de negocio.** Es el mismo
criterio que el dueño fijó para Solutions («esquema propio, nunca sobre
`ranchos.detalles`») y el que hizo posible que Linksy estrenara dominio sin
tocar el producto.

## Reutilizable (se usa tal cual o con un envoltorio fino)

| Área | Pieza | Nota |
|---|---|---|
| Auth | Supabase Auth, `FormularioAuth destino=`, `/auth/callback?next=`, `usuarioActual()`, `requireAdmin()`, `is_admin()` | misma cuenta; `celebrar_perfiles` para lo propio |
| Usuarios | `auth.users`, `perfiles` | solo lectura del rol; no se altera |
| Pagos | Stripe Checkout `mode: payment`, webhook `/api/stripe/webhook`, `eventos_stripe`, `Puerta`, SINPE/transferencia con comprobante | un `checkout-celebrar.ts`; despacho por `metadata.bookea_producto` |
| Correo | `enviarCorreo()` (Resend), `layoutBento`, rebotes, supresiones | plantillas propias con marca CELEBRAR |
| QR | `qrcode` (npm) | no usar `urlQr()` (servicio externo) |
| Media | `media_assets` + R2 + Cloudflare Images, sesiones de subida, capacidades anónimas, cuotas, Turnstile, `resolverVisual`, `precios.ts` | nuevas `entity_type` `celebrar_*` |
| IA | `AIProvider`, proveedores Claude/Gemini, `MODELOS`, tope mensual, `registrarUsoIA()` → `uso_ia` | costos de texto se espejan en `celebrar_costos` |
| Utilidades | `sanearHtmlInvitacion`, `invitaciones-retencion.ts`, `dinero.ts`, `paises.ts`, `monedas.ts`, `hashVisitante()` | |
| Dominios | patrón de `src/lib/solutions/dominios.ts` + bloque del proxy | copiar como `src/lib/celebrar/dominios.ts` |
| Infra | Vercel `aventurar-cr`, Supabase `bjhprmtobmualefvcmau`, Cloudflare (R2/Images), crons con `CRON_SECRET`, `after()` | ni un proyecto nuevo |
| Componentes UI | `recortar-imagen`, `subir-imagen`, `boton-copiar`, `campo-color`, `mapa-punto`, `imprimir` | revisar uno por uno; la estética es otra |

## Nuevo para CELEBRAR

| Área | Qué | Dónde |
|---|---|---|
| Shell y marca | layout, nav, footer, tokens `.celebrar`, landing, cómo funciona, precios | `src/app/celebrar/` |
| Celebraciones | `celebrar_celebraciones`, `celebrar_slugs`, `celebrar_perfiles` | 0242 |
| Plantillas | `celebrar_plantillas`, `_categorias`, `_secciones`, `_variantes` (JSON de secciones + render React; legado como `html_legado`) | 0242 |
| Invitación | `celebrar_invitaciones` (invitación, save the date, recuerdos), RPC pública por slug | 0243 ✓ |
| Música | bucket `celebrar-media` (solo la dueña escribe en su carpeta) | 0244 ✓ |
| Créditos | `celebrar_creditos_movimientos` (ledger; el saldo es la suma), RPC `celebrar_saldo` / `celebrar_consumir_creditos` (candado por cuenta) / `celebrar_acreditar_creditos` (service role), `pago_publicacion` en la celebración | 0245 ✓ |
| RSVP | `celebrar_confirmaciones` + RPC anónima `celebrar_confirmar(p_slug, …)`; preguntas configurables en `rsvp.datos.preguntas` | 0245 ✓ |
| Usos de IA | `celebrar_ia_usos` (enfriamiento de 5 min por campo, en el servidor) | 0245 ✓ |
| Compras con Stripe | `monto_crc` en el libro, `celebrar_acreditar_creditos(…, p_monto_crc)`, RPC admin (`celebrar_admin_resumen_creditos`, `_movimientos`, `_buscar_cuenta`), políticas de lectura para admin | 0246 ✓ |
| Partners | `celebrar_partners` (privilegios por columna), `celebrar_partner_plantillas`, `celebrar_celebraciones.cliente`, RPC `celebrar_admin_partner_estado` / `celebrar_admin_partners` / `celebrar_partner_de` / `celebrar_partners_directorio` | 0247 ✓ |
| Costos | `celebrar_costo_categorias`, `_tarifas`, `celebrar_costos`, vista de rentabilidad | pendiente |
| Álbum, firmas, regalos, QR | `celebrar_albumes`, `_album_items`, `celebrar_firmas`, `celebrar_regalos`, `celebrar_qr`, `_qr_escaneos` | pendiente |
| Video | `VideoProvider`/`ImageProvider`, `celebrar_videos`, `celebrar_trabajos` (cola) | pendiente («videos aún no», dueño 21 sep) |
| Métricas, auditoría, config | `celebrar_metricas_eventos`, `_metricas_dia`, `celebrar_auditoria`, `celebrar_configuracion` | pendiente |
| Admin CELEBRAR | `/celebrar/admin/*` con shell propio | |
| Editor visual | un solo renderizador React (`RenderInvitacion`, modo editor/publico/demo) dentro de `<Telefono>`; secciones tocables y textos editables en su lugar (`texto-editable.tsx`) | |

## Toques a Bookea (todos aditivos, cada uno de 1–10 líneas)

1. `src/proxy.ts` — bloque `esHostCelebrar` (hecho en Fase 1); `/celebrar/admin` en la guardia queda para la Fase 8, cuando exista la ruta.
2. `src/lib/solutions/dominios.ts` — `esHostPropio` reconoce `celebrar.lat` (hecho).
3. `src/lib/slug.ts` — `RESERVED_SLUGS` += `celebrar` (hecho).
4. `src/components/chat-flotante-lazy.tsx` — no monta la burbuja bajo `/celebrar` ni en `celebrar.lat` (hecho en Fase 1; el componente grande no se tocó).
5. `src/lib/pagos/suscripciones.ts` — `mode === "payment"` despacha por producto.
6. `src/lib/media/tipos.ts` + migración — entidades `celebrar_*` en `media_assets`.
7. `src/app/sitemap.ts` — celebraciones publicadas.
8. (opcional) `/cuenta` y `secciones-admin.ts` — un link «CELEBRAR».

## Riesgos y dependencias peligrosas

- **Invitaciones Digitales ya existe** (tablas `invitaciones`, `invitacion_rsvp`,
  `albumes`, rutas `/invitaciones`, `/i`, `/a`, app móvil). CELEBRAR no las
  toca; conviven hasta la paridad. Hay un rediseño de `/invitaciones` **sin
  commit** en el árbol: no pisarlo.
- **`bookea.app` no existe**; el dominio es `bookea.lat`.
- **Stripe**: hoy todo pago suelto se interpreta como invitación; sin el
  despacho por producto, una compra de créditos se cobraría y se ignoraría.
- **Cookie de sesión** no cruza `bookea.lat` ↔ `celebrar.lat`. Resuelto por
  diseño (D-3): CELEBRAR tiene su propio login y su propio callback
  (`/celebrar/auth/callback`, que en `celebrar.lat` es `/auth/callback`); la
  persona entra una vez por dominio con la misma cuenta. Falta, el día del
  estreno, agregar esa URL a las Redirect URLs de Supabase Auth.
- **Funciones SQL compartidas de `media_assets`** se reemplazan para sumar
  entidades: solo agregar ramas y correr los tests de `src/lib/media`.
- **App móvil**: Apple 3.1.1 impide vender créditos ahí; CELEBRAR es web-first
  y la app, si algo muestra, es lectura. Excepción explícita a la paridad.
- **Video**: nada de render en requests de Vercel; cola + render en cliente o
  worker externo. Cloudflare Images no sirve MP4.
- **Despliegues congelados** (7 sep 2026) y migraciones **0239/0240 pendientes**;
  CELEBRAR numera desde **0242** y se prueba en `localhost:3100`.
- **Enumeración** de datos personales: cero `select` anónimo; RPC por slug
  (lección de 0221–0224).

## Interruptor de dominio

`NEXT_PUBLIC_CELEBRAR_URL` vacía → todo bajo `https://www.bookea.lat/celebrar`.
Con `https://celebrar.lat` → links, QR, OG y canónicos usan el dominio propio y
`bookea.lat/celebrar/*` responde `301`. El paso a paso está en la sección P de
la auditoría.
