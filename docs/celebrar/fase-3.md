# CELEBRAR — Fase 3: plantillas, editor en vivo, IA y página pública

> Hecha el 21 de setiembre de 2026, en local (`localhost:3100`). **Sin
> commit, sin deploy.** La migración **0243 quedó APLICADA** con el OK
> general del dueño («aplicá las migraciones que necesités») y las **440
> plantillas quedaron sembradas** en la base viva. Verificado de punta a
> punta en el navegador — detalle en «Verificaciones».

Pedido del dueño (con la captura de fiestly.com): plantillas ya hechas
que se editan **en tiempo real** —40 por tipo de celebración, donde se
puede cambiar todo: fotos, orden de las secciones, cuenta regresiva…— y,
como segunda puerta, **crear la invitación desde cero con IA** pagando con
créditos. Las dos opciones viven en la misma pantalla.

## Qué hace ahora

| Dónde | Qué |
|---|---|
| `/celebrar/editor/[id]` (sin diseño) | El selector: arriba «Crearla con IA» (un texto libre → invitación completa) y abajo las **40 plantillas del tipo** de la celebración, con miniaturas fieles (letra, paleta, portada, motivo) y filtro por categoría. «Usar esta» aplica la plantilla ya rellenada con los datos de la celebración |
| `/celebrar/editor/[id]` (con diseño) | El editor: teléfono a la izquierda con la invitación **renderizada en vivo** (alternable a escritorio); a la derecha cuatro pestañas — **Esencial** (saludo, nombre, frase, fecha en portada), **Secciones** (orden con flechas, interruptor de visibilidad, campos de cada una, quitar/agregar), **Fotos** (portada, historia, galería de hasta 12; recorte 4:5 y subida directa a Cloudflare) y **Estilo** (8 paletas del tipo + colores propios, fuente del título y del texto, 6 portadas, 8 motivos decorativos, bordes, animaciones). Guarda solo a los 900 ms de quietud; avisa si se cierra con cambios sin guardar |
| Barra del editor | Volver · estado (Guardando… / Guardado ✓ / error) · teléfono/escritorio · **Cambiar diseño** (vuelve al selector sin perder nada hasta elegir otro) · **Vista previa** · **Publicar / Despublicar** |
| `/celebrar/editor/[id]/previa` | La invitación a pantalla completa, tal como la verán, solo para la dueña |
| `/celebrar/[slug]` | **La página pública.** Estática con revalidación cada 60 s, `<title>` + Open Graph propios (imagen 1200×630 con la paleta y las letras de la invitación), Google Fonts solo de las dos fuentes usadas. Un slug histórico redirige (308) al actual. Borrador → 404 |
| Ficha `/celebrar/app/celebraciones/[id]` | Card «La invitación» (Abrir el editor / Vista previa, o «Elegir diseño» si no hay), «Abrir la invitación» cuando está publicada; el acceso «Diseño» en cada tarjeta de la lista |

## El modelo: un `Documento` JSON

Una invitación es **datos, no HTML**: `{ version: 1, plantilla, estilo,
secciones[] }`, en `src/lib/celebrar/invitacion/esquema.ts`.

- `estilo`: paleta (`fondo`, `tinta`, `acento`, `suave`, `superficie`),
  `fuenteTitulo`/`fuenteTexto` (22 fuentes de Google en `fuentes.ts`),
  `heroe` (6 portadas), `decoracion` (8 motivos SVG), `bordes`,
  `animaciones`.
- `secciones`: lista ordenada de `{ id, tipo, visible, datos }` con 11
  tipos (`hero`, `countdown`, `detalles`, `ubicacion`, `historia`,
  `galeria`, `dress_code`, `rsvp`, `regalos`, `mensaje`, `faq`); los
  campos de cada tipo están tipados y **`normalizarDocumento` sanea
  cualquier JSON** (de una plantilla, del editor o de la IA): siempre hay
  exactamente una portada primera, los colores se validan, las listas se
  recortan a sus máximos.
- `rellenarConCelebracion(doc, c)` mete nombre, fecha, hora y lugar donde
  la plantilla dejó huecos.

**Un solo renderizador** (`components/celebrar/invitacion/render-invitacion.tsx`)
pinta el mismo `Documento` en la previa del editor, en `/previa` y en la
página pública. Recibe `modo="editor" | "publico"`: en el editor las
secciones vacías muestran una pista («las fotos que subás van a aparecer
acá», «agregá tu WhatsApp para que el botón funcione»); en la pública **se
omiten** para que la persona invitada no vea huecos ni botones muertos.

## Las 440 plantillas

Generadas de forma **determinista** por `src/lib/celebrar/plantillas/generador.ts`
(6 portadas × 8 paletas por tipo × pares de fuentes según el carácter del
tipo × motivos), con 40 nombres propios por tipo y una categoría del
catálogo cada una; cada cuarta es «premium» (30 créditos, cobro en Fase 4).
Las 8 paletas de cada tipo (`paletas.ts`) cumplen contraste
tinta/fondo ≥ 4.5 y suave/fondo ≥ 3 (hay test).

Se siembran con `npx tsx scripts/celebrar-sembrar-plantillas.mts`
(`--dry-run` para ver sin escribir): **upsert por slug** con la service
role, así se pueden regenerar sin duplicar. Las 3 plantillas de muestra
de la 0242 quedaron `activa = false`.

Como son datos y no código, más adelante se pueden **curar a mano** desde
un admin (cambiar una paleta, renombrar, desactivar) sin tocar el
generador.

## La IA (segunda puerta)

`generarConIA(celebracionId, prompt)` en `editor/ia-acciones.ts`: system
prompt con el esquema JSON, `ClaudeProvider` con el modelo de
`modeloDe("invitacion_generar")`, respeta el tope mensual
(`motivoParaNoGastar`) y registra el gasto en `uso_ia` con el agente nuevo
`celebrar_generar`. La respuesta pasa por `extraerJson` →
`normalizarDocumento` → `rellenarConCelebracion` y se guarda con
`plantilla_slug = null`.

> ⚠️ **No descuenta créditos todavía.** El libro de créditos y su compra
> son la Fase 4; hasta entonces cada generación cuesta tokens reales a
> Bookea sin cobrarle a nadie. Está construida y probada, pero conviene
> no anunciarla hasta cerrar la Fase 4.

## La migración 0243 (`supabase/migrations/0243_celebrar_invitaciones.sql`)

Aditiva e idempotente. Una tabla y una RPC:

| Objeto | Para qué |
|---|---|
| `celebrar_invitaciones` | `celebracion_id` → celebración (cascade), `tipo` (`invitacion` / `save_the_date` / `recuerdos`, única por celebración), `contenido` jsonb (el `Documento`, ≤ 256 KB por `pg_column_size`), `plantilla_slug`, `version`, `publicada_en` |
| RLS | todo por `celebrar_es_duena(celebracion_id)` (select/insert/update/delete solo la dueña) |
| `celebrar_invitacion_publica(p_slug)` | security definer para `anon`: devuelve la celebración **publicada** con su `contenido` y `slug_actual` (si `p_slug` es histórico, dice cuál es el vigente para redirigir). No devuelve borradores |
| `celebrar_slugs` | se reserva `editor` como ruta de sistema |

Aplicada con `node scripts/aplicar-migracion.mjs 0243`. Las 0239 y 0240
(Linksy y Lealtad) siguen pendientes: son de otros productos.

## Código nuevo

```
src/lib/celebrar/invitacion/       esquema.ts (modelo + normalización), fuentes.ts
src/lib/celebrar/plantillas/       paletas.ts, generador.ts (+ test)
src/components/celebrar/invitacion/ render-invitacion.tsx, decoracion.ts, cuenta-regresiva.tsx
src/components/celebrar/editor/    editor-invitacion.tsx, elegir-plantilla.tsx, miniatura-plantilla.tsx,
                                   panel-{esencial,secciones,fotos,estilo}.tsx, campos.tsx
src/app/celebrar/editor/           layout.tsx, acciones.ts, ia-acciones.ts, [id]/page.tsx, [id]/previa/page.tsx
src/app/celebrar/(publico)/        layout.tsx, [slug]/{page,opengraph-image}.tsx, [slug]/datos-publicos.ts
scripts/celebrar-sembrar-plantillas.mts
supabase/migrations/0243_celebrar_invitaciones.sql
```

Acciones de servidor (`acciones.ts`): `elegirPlantilla`, `guardarDocumento`,
`cambiarPublicacion`, `prepararSubidaCelebrar`. Todas comprueban la
sesión y dejan que RLS decida la propiedad.

## Toques a Bookea (aditivos, como en fases anteriores)

| Archivo | Qué |
|---|---|
| `src/components/subir-imagen.tsx` | preset `foto` nuevo (lado 1600, calidad 0.86, relación 4:5). Los presets existentes no cambian |
| `src/lib/ia/modelos.ts` | agente `celebrar_generar` en `AgenteIA` y `NOMBRE_AGENTE` (aparece en el admin de IA con nombre propio) |
| `src/lib/celebrar/rutas.ts` | `RUTA.editor`, `rutaEditor(id)`, `editor` en `SEGMENTOS_SISTEMA` |

## Dependencias y notas

- **Cloudflare Images** es obligatorio para las fotos (subida directa desde
  el navegador vía `solicitarSubidaDirecta`, entrega por `imagedelivery.net`).
  Sin `CLOUDFLARE_*` en el entorno el uploader dice que falta configurar;
  el resto del editor funciona.
- **Google Maps**: la sección «Dónde» incrusta `google.com/maps?q=…&output=embed`
  (sin API key, como hace Bookea) y «Cómo llegar» abre `maps_url` o la
  búsqueda por dirección.
- **RSVP provisional por WhatsApp** (`wa.me`, prefijo 506 si son 8 dígitos).
  El RSVP propio con lista de invitados es la Fase 6; mientras, sin
  WhatsApp la sección se omite en la pública.
- **Cuenta regresiva** en hora de Costa Rica (UTC−6), cliente, se apaga
  sola pasado el evento.
- **Página pública estática 60 s**: tras publicar o cambiar algo, la
  pública puede tardar hasta un minuto en reflejarlo. Aceptable para
  invitaciones; si molesta, `revalidatePath` desde `cambiarPublicacion`.
- La imagen Open Graph (`opengraph-image.tsx`) **prerrenderiza bien en el
  build** pero en `next dev` local da 500 (`sharp` / «unsupported image
  format»); pasa con TODAS las OG del repo, no es de CELEBRAR.
- Al editar las **plantillas históricas** (en `celebrar_plantillas.esquema`)
  las invitaciones ya creadas no cambian: cada invitación guarda su copia
  del `Documento`.

## Verificaciones

- `npx tsc --noEmit` limpio; `npx eslint` sobre `src/{app,components,lib}/celebrar`
  y el script: 0 avisos; `vitest`: 176 archivos / 3446 tests en verde
  (nuevos: `generador.test.ts`, `dominios.test.ts` ampliado).
- `npm run build` (con el dev parado) pasa; las rutas `/celebrar/editor/[id]`,
  `/celebrar/editor/[id]/previa`, `/celebrar/[slug]` y su `opengraph-image`
  aparecen como dinámicas.
- En el navegador con la sesión del dueño, celebración de prueba «Sofía &
  Andrés» (`a280ef77-…`, slug `sofia-y-andres`):
  1. selector con las 40 plantillas de boda y el panel de IA → «Usar esta»
     en *Jardín Secreto* → editor con previa y «Guardado ✓»;
  2. saludo editado → previa al instante → autosave confirmado en la base;
  3. Estilo: paleta *Marino y champán* aplicada sin avisos de React (se
     corrigió el `background` atajo vs `backgroundImage` del patrón);
  4. Secciones: apagar la cuenta regresiva y moverla con las flechas, sin
     que el desplegable se abra (se corrigió: el `preventDefault` del
     `<summary>` también anulaba el `label` del interruptor);
  5. Fotos: portada subida a Cloudflare con recorte 4:5 → aparece en la
     previa y queda en el documento;
  6. Publicar → «¡Publicada! Tu link ya está activo» → `/celebrar/sofia-y-andres`
     200 con `<title>`, `og:*` y fuentes; renombrar el slug → el viejo
     responde 308 al nuevo; restaurado después;
  7. la pública omite la galería vacía y el RSVP sin WhatsApp (7 secciones
     frente a 9 en el editor).
- La celebración de prueba **queda en la base, publicada**, como demo;
  se archiva desde su ficha si el dueño no la quiere.

## Lo que sigue (Fase 4)

Créditos: tabla de saldo y movimientos (`celebrar_creditos_*`), compra por
Stripe **ramificando por `metadata.bookea_producto = "celebrar"`** antes de
acreditar (nunca asumir que un pago es una invitación), cobro de las
plantillas premium (30) y de la generación con IA, y el candado en
`elegirPlantilla` / `generarConIA` cuando el saldo no alcanza. Después,
Fase 5 (costos y márgenes), Fase 6 (RSVP propio, álbum) y el admin del
catálogo.
