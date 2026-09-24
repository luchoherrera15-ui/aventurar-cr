# CELEBRAR · Fases 4 y 6 (v1): monedero de créditos, confirmaciones en la página e Invitados

Fecha: 21 sep 2026. Todo en local (`localhost:3100`), sin commit ni deploy.
Migraciones **0244** (media) y **0245** (créditos, confirmaciones, usos de IA)
APLICADAS en producción con la autorización del dueño.

## Qué pidió el dueño

- «Sistema de créditos MONEDERO»: ver el saldo; una invitación con panel de
  invitados alrededor de **$12–14**, **$8** si confirma por WhatsApp.
- «INVITADOS» = el panel conectado con la invitación (y con los add-ons
  futuros: álbumes, etc.), con las respuestas: «sí asistiré, nombre,
  cantidad de personas, alergias» — y **cada pregunta la configura la
  persona en la invitación**.
- Los iconos de IA en los campos de texto (Gemini), 3 opciones por
  campo; luego **limitar: 3 opciones, y para otras 3 esperar 5 minutos**.
- Generar la invitación completa con IA (Sonnet) con un botón para probar
  y ver el costo real.
- Las previas del catálogo con imágenes (como fiestly).
- Las plantillas al estándar de `/i/demo-boda-premium`: animadas al
  scrollear, con la animación seleccionable; «Carta de Amor» como demo del
  teléfono en `/celebrar`.
- Última tanda: **editar los textos desde el visualizador** (el teléfono) y
  quitar los fondos/motivos «que hacen que se vea mal y sea difícil de
  entender el diseño».

## Precios (v1, ajustables desde `src/lib/celebrar/creditos.ts`)

| Concepto | Créditos | ₡ | ≈ US$ |
| --- | --- | --- | --- |
| 1 crédito | 1 | ₡50 | $0,10 |
| Publicar · confirmación por WhatsApp | 80 | ₡4 000 | $7,80 |
| Publicar · confirmación en la página + Invitados | 120 | ₡6 000 | $11,70 |
| Invitación completa con IA | 5 | ₡250 | $0,49 |
| Textos con IA, plantillas, fotos, música, edición | 0 | gratis | — |

Paquetes: 100 cr. ₡5 000 · 250 cr. ₡11 500 (más elegido) · 500 cr. ₡21 000.
Los botones «Comprar» dicen **«pronto»**: el checkout (Stripe / SINPE) NO
se construye hasta que el dueño confirme (regla de CLAUDE.md sobre pagos).
Mientras, `node scripts/celebrar-acreditar-creditos.mjs <correo> <cantidad>
[concepto] [referencia]` acredita a mano con la service role (300 créditos
de prueba al dueño, referencia `prueba-dueno-2026-09-21`).

## La base (0245)

- `celebrar_creditos_movimientos`: libro de movimientos (compra, consumo,
  regalo, ajuste, reembolso). **El saldo es la suma.** `referencia` única
  cuando existe: un webhook repetido no acredita dos veces.
- RPCs: `celebrar_saldo()` (invoker), `celebrar_consumir_creditos(p_celebracion,
  p_concepto, p_cantidad, p_referencia)` con **candado advisory por cuenta**
  (dos consumos simultáneos no gastan el mismo saldo; lanza «Saldo
  insuficiente» con el faltante en `detail`), `celebrar_acreditar_creditos`
  solo `service_role`.
- `celebrar_celebraciones.pago_publicacion jsonb` = `{plan, creditos, en}`:
  despublicar y volver a publicar **no cobra otra vez**; pasar de WhatsApp a
  panel cobra solo la diferencia (40).
- `celebrar_confirmaciones`: nombre, asiste, personas, `respuestas jsonb`
  (id de pregunta → valor), mensaje, contacto. Entran por la RPC anónima
  `celebrar_confirmar(p_slug, …)` contra una celebración **publicada**; la
  dueña las lee por RLS.
- `celebrar_ia_usos`: un renglón por campo y corrida, para el enfriamiento
  de 5 minutos **en el servidor** (no se salta recargando).
- **Trampa encontrada al probar**: los `default privileges` del proyecto no
  alcanzaron; `celebrar_saldo()` respondía «permission denied for table».
  El 0245 termina con `grant select … to authenticated` explícitos (y
  `grant all … to service_role`). Aplicado en vivo.

## El flujo, probado de punta a punta en el navegador

1. Editor → **Publicar** → diálogo con plan («Con confirmación en la
   página…»), costo (120 cr. · ₡6 000), saldo (300) y lo que queda (180).
2. Confirmar → `cambiarPublicacion` cobra vía RPC, escribe
   `pago_publicacion` y publica. Movimiento: `consumo −120 «Publicar la
   invitación (confirmación en la página)»`.
3. `/celebrar/sofia-y-andres` → formulario al final → «Te anotamos con 2
   lugares para Sofía & Andrés» (texto neutro, sin género).
4. `/celebrar/app/invitados` → 1 confirmaron · 2 personas · tabla con las
   columnas de las preguntas configuradas · **Descargar CSV** (BOM UTF-8,
   abre en Excel).
5. Despublicar → Publicar → «Ya pagado», saldo sigue en 180.

Arreglo en el camino: el link del CSV se escribía con `<a href>` crudo y
salía sin `/celebrar` → nuevo `<EnlacePlanoCelebrar>` en `rutas-cliente.tsx`
para descargas (donde `<Link>` no aplica). Regla ya escrita en `rutas.ts`:
ningún literal `/celebrar/…` en JSX.

## RSVP configurable

`rsvp.datos`: `modo: "whatsapp" | "panel"`, `pedirPersonas`, `pedirContacto`,
`preguntas: PreguntaRsvp[]` (`texto | numero | opcion | si_no`, con
`obligatoria` y `opciones`). Por defecto trae «¿Alguna alergia o
restricción alimentaria?». El constructor vive en Secciones → Confirmación
(Contenido) con los precios de cada modo al lado; el formulario público
(`formulario-rsvp.tsx`) pinta cada tipo y guarda `respuestas` por id.

## IA

- **Textos** (`ia-textos.ts`): Gemini 3.5 Flash Lite, `thinkingLevel:
  MINIMAL` (la API ya no acepta `thinkingBudget: 0` → 400; cambio en el
  proveedor compartido `src/lib/ia/gemini-provider.ts`, con `abortSignal`),
  20 s de tiempo máximo y modelo de respaldo `gemini-flash-lite-latest`
  (hubo un episodio de 503 «high demand»). **Enfriamiento de 5 minutos por
  campo**, contado en el servidor; el popover muestra la cuenta regresiva.
- **Invitación completa** (`ia-acciones.ts`): modelo elegible (Sonnet 5 por
  defecto; también Gemini Flash Lite, Haiku 4.5, Opus 5); devuelve el costo
  real. Prueba con Sonnet 5: **₡20,7 / US$0,0398**, 2 456 tokens de entrada
  y 2 163 de salida, 22 s. A 5 créditos (₡250) el margen es ~12×.
- Trampa (dos veces): un archivo `"use server"` solo puede exportar
  funciones async → las constantes (`TONOS`, `ENFRIAMIENTO_MS`) van en
  módulos aparte (`ia-tonos.ts`) o sin exportar.

## Edición de textos en el visualizador (última tanda)

`components/celebrar/invitacion/texto-editable.tsx`: `<Texto sid ruta valor>`
envuelve cada texto de la invitación. En la página pública es un `<p>/<h1>`
común. Dentro del editor (contexto `ProveedorEdicionTexto`):

- un clic lo vuelve `contenteditable="plaintext-only"` (con respaldo para
  navegadores viejos: `true` + pegado como texto plano) y **pone el cursor
  donde se hizo clic** (`caretPositionFromPoint` / `caretRangeFromPoint`);
- cada tecla actualiza el documento por **ruta** (`asignarRuta(datos,
  "items.2.titulo", valor)` en `lib/celebrar/invitacion/ruta-datos.ts`, con
  test): la previa y el campo del panel van a la par, y el autoguardado
  corre igual;
- Enter confirma en los de una línea (Ctrl/⌘+Enter en los multilínea),
  Escape deshace, salir del campo cierra;
- mientras se edita React renderiza `null` como hijos y el texto vive en el
  DOM (el cursor no salta con cada re-render); al cerrar se vacía el nodo
  a mano antes de que React vuelva a pintar (si no, el texto se duplica).

Textos editables: portada (saludo, nombre, frase), títulos de todas las
escenas, textos, programa (hora/título/detalle), lugares propios (título,
lugar, dirección), grupos y texto de vestimenta, regalos (título/detalle) y
SINPE, mensaje (título/texto/firma), preguntas y respuestas. La fecha y la
hora se editan en Esencial (vienen de la celebración, no del documento).

## Fondos y motivos «que ensuciaban» (última tanda)

Diagnóstico mirando el catálogo: patrón detrás del texto + adornos de
esquina + marco doble + rayado del fondo vivo sobre la foto = cuatro capas
de ornamento en la misma pantalla. Cambios:

- **Renderizador** (`llevaMotivo`): el motivo nunca va sobre una foto (ni la
  de ambiente ni la portada-foto) y **no va en la portada cuando lleva
  adornos de esquina** (las esquinas ya son el adorno). Opacidades
  sutil/media/fuerte: 0,10 / 0,19 / 0,32 (antes 0,22 / 0,40 / 0,62).
- Fondos vivos de borde duro (**líneas**, **malla**) se apagan sobre foto de
  ambiente; los blandos (aurora, ondas, degradado, destello, círculos) van a
  la mitad (`atenuado`). Las líneas, además, a media voz (×0,5) y más
  separadas (34 px).
- **Generador**: `decoracionIntensidad: "sutil"` y, si el motivo es denso,
  disposición «guirnalda» (solo arriba y abajo) en vez de «todo»; solo
  puntos, líneas, cuadrícula y olas pueden ir detrás del texto. Familias
  Clásica y Académica pasan de «líneas» a «destello». **Re-sembradas** las
  440. La persona puede subir la intensidad desde Estilo si quiere.

## Verificación

eslint 0 · vitest 3 454 (177 archivos) · `npm run build` OK · flujo completo
de créditos/RSVP/CSV probado en el navegador · edición en el teléfono
probada (cursor donde se hace clic, panel sincronizado, Enter/Escape,
«Guardado ✓», sin duplicar texto, `&` en acento vuelve al cerrar).

## Pendiente / decisiones del dueño

- **Checkout de créditos** (Stripe: ramificar `mode=payment` por
  `bookea_producto`; SINPE manual): requiere OK explícito.
- Confirmar el valor del crédito (₡50) vs. la propuesta del documento de
  costos (comentario abierto en el Claude Doc).
- Paridad móvil de todo CELEBRAR (la app de Bookea no tiene nada de esto).
- Avisar al anfitrión por correo/WhatsApp cuando entra una confirmación.
- Álbumes y demás add-ons cuelgan del mismo panel Invitados («cuando estén…»).
