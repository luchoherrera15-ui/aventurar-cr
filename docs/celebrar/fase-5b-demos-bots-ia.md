# CELEBRAR · Fase 5b: «Ver demos», bots de IA con precio fijo y arreglos del editor

Fecha: 21 sep 2026 (noche). En local (`localhost:3100`), sin commit ni deploy.
Migración **0248** (slugs `demos`/`demo` reservados) APLICADA.

## Ver demos

Pedido: «una sección tipo ver demos… cinco invitaciones bien profesionales,
bien animadas, con música… un demo de álbum digital… un demo del panel».

- **Catálogo** en `src/lib/celebrar/demos.ts` (7 muestras; 5 destacadas con
  música): Carta de Amor (boda, saxo), Noche de Rubí (XV, «princesas»),
  Selva de dinosaurios (7 años, «dinosaurios»), Noche mágica (8 años,
  «magia»), Gala Anual 2027 (corporativa, saxo lounge), Jardín (boda) y
  Birrete (graduación). Cada una con dirección de arte propia (paleta,
  letras, portada, motivo, esquinas, fondo vivo, partículas, entrada),
  programa, vestimenta con colores, galería, regalos, preguntas y el
  **formulario de confirmación con preguntas configuradas** (modo panel).
  Las pistas son las que Bookea ya tiene con licencia en Storage
  (`invitaciones-demo/*`); las fotos, Unsplash verificadas a ojo con una
  hoja de contacto (`scratchpad/hoja-fotos.html`).
- **Rutas**: `/celebrar/demos` (índice, en el sitio), `/celebrar/demos/<id>`
  (invitación a pantalla completa, `modo="demo"`, escenario de escritorio,
  barra flotante «Más demos · Crear mi invitación»), `/celebrar/demos/album`
  y `/celebrar/demos/panel`. Grupo `(demos)` con su propio layout (sin nav,
  con `ProveedorRutas`).
- **Álbum** (`components/celebrar/demo/album-demo.tsx`): portada con la
  fiesta, «Subir mis fotos» (explica el QR de la mesa), filtros por momento,
  mosaico con autor y corazones (se cuentan en pantalla), foto en grande.
  Datos en `lib/celebrar/demo-album.ts`.
- **Panel** (`(demos)/demos/panel/page.tsx`): el shell real del panel con
  datos de muestra —confirmaciones con las columnas de las preguntas
  configuradas (Menú, Alergias), balance de créditos, la invitación— y el
  aviso «Demo del panel · Crear mi cuenta».
- **Portada**: sección «Ver demos» después de las ocasiones, con las
  tarjetas destacadas + álbum + panel; «Demos» en el nav. El teléfono del
  héroe ahora rota solo las destacadas (`DEMOS_DESTACADAS`).

## Bots de IA con precio fijo (sin modelos ni costos internos)

Pedido: «no puede salir así como el más barato… nuestros propios bots… un
costo fijo por bot… primero ingresar datos (nombre, fecha, años, lugar) y
que genere el prompt».

- `lib/celebrar/ia-modelos.ts` → **BOTS_IA**: Chispa (3 cr., Gemini Flash
  Lite), **Musa** (8 cr., Sonnet 5, recomendada), Maestra (15 cr., Opus 5).
  El modelo detrás de cada bot es cosa nuestra; la UI no lo muestra.
- `lib/celebrar/ia-prompt.ts` (+ test): `DatosIA` (quién, edad, estilo,
  colores, tono, secciones, extra) → `armarPedidoIA()` en prosa. Fecha y
  lugar vienen de la celebración.
- `components/celebrar/editor/crear-con-ia.tsx`: **datos → pedido editable
  → bot**; muestra «Crear con Musa · 8 créditos», el saldo, y al terminar
  «Se usaron 8 · te quedan N». Vive detrás de un **botón con el icono de
  IA** que abre la ventana (pedido posterior del dueño: «que no esté así
  expuesto»); el catálogo ocupa todo el ancho (5 columnas).
- `editor/ia-acciones.ts`: `generarConIA(celebracionId, {prompt, datos},
  bot)` revisa el saldo, genera, guarda y **cobra el precio del bot** con
  `celebrar_consumir_creditos`. El costo real (tokens, ₡) sigue en `uso_ia`
  para el equipo. `PRECIOS.invitacion_ia = 3` («desde»).
- Lo que genera la IA es un `Documento` normal: editable sección por
  sección, textos en el teléfono, y se puede guardar como plantilla.

## Arreglos del editor

- El cuadro «Escribir con IA» de cada campo quedaba **recortado** por la
  tarjeta de la sección (`overflow: hidden`) y no se podía bajar a ver las
  opciones → ahora va en un **portal fijo** anclado al botón, con scroll
  propio y recolocación al scrollear (`asistente-texto.tsx`). Su rótulo dice
  «Chispa · incluido» (antes «Gemini · créditos»).

## Verificación

eslint 0 · vitest **3 472** (179 archivos) · `npm run build` OK · todas las
rutas de demos 200 · capturas de escritorio y teléfono de las 5 destacadas,
el álbum, el panel, la portada y el modal de IA con
`scripts/celebrar-qa.mjs` (sesión del dueño fabricada + CDP).

## Pendiente
- Una pista propia para graduaciones/corporativos (hoy la gala reutiliza el saxo).
- Directorio: página propia por partner; correo al aprobar.

## Añadido el 22 sep 2026 (madrugada)

### La apertura: todas las invitaciones llegan cerradas
Pedido: «que sea tipo una carta que se abre… al abrirla se reproduzca la
música… quiero que todas las invitaciones tengan eso».

- `estilo.apertura`: `sobre` (carta con sello que se abre; por defecto),
  `destello` (un flash la revela), `telon` (se abre a los lados) o
  `directa`. Selector en Estilo → «Apertura».
- `apertura-invitacion.tsx`: capa FIJA sobre la página con la paleta y las
  letras de la invitación (va fuera del artículo, que por su contención de
  layout encerraría un `fixed`), bloquea el scroll mientras está cerrada, y
  al tocar corre la animación, dispara `celebrar:abrir` y se desmonta.
  `Musica` escucha ese evento y arranca: ese toque es el gesto que el
  navegador exige para el audio. Respeta `prefers-reduced-motion`.
- Se muestra en la página pública, en los demos a pantalla completa y en
  la vista previa; nunca en el editor ni en el teléfono del héroe.
- Las 440 plantillas se re-sembraron con apertura (carta para elegantes y
  formales, destello para alegres y modernas).

### Parque de dinosaurios (demo rehecho «estilo película», sin marcas)
- Piezas nuevas del renderizador: motivo **Dinosaurios** (siluetas de
  tiranosaurio y cuello largo, huellas, frondas), esquinas **Selva**
  (frondas con foliolos cerrados; la primera versión con líneas parecía
  telaraña) y divisor **Huella**.
- Paleta selva profunda / hueso / ámbar, Bebas + Nunito, portada con selva
  brumosa, escenas con foto (acantilados, bosque), programa «Ruta de la
  expedición», «Uniforme de guardaparques», «Protocolo del parque».
- Regla nueva: con un título display (bebas, oswald, abril, fredoka, baloo)
  el lema va en la letra de texto (`.inv-lema-texto`), no en cursiva del título.

### «¿No estás contento con tu diseño?» (0249)
- Bloque en la ficha de la celebración y al final de Estilo en el editor:
  alcance (ajustes / rediseño / a medida), qué mejorar, contacto. Guarda en
  `celebrar_ayuda_diseno` y avisa al equipo por correo con el link al
  editor de esa invitación.
- Bandeja `/app/admin/diseno`: pendientes primero, abrir su editor, ver la
  invitación, marcar en proceso/atendida con nota. Probado de punta a punta.

### Login solo con código por correo
- Se quitó la pestaña «Con contraseña» y los botones sociales de la
  pantalla de entrada; `/entrar/recuperar` y `/entrar/nueva-contrasena`
  redirigen a `/entrar`. El panel y el editor ya exigían sesión; lo único
  visible sin cuenta es el demo del panel (`/demos/panel`).

## Añadido el 22 sep 2026 (mañana): el catálogo sin huecos

El dueño encontró combinaciones vacías en el filtro («Elegante + Corporativos:
no hay diseños»). Medido: **73 de 121 cruces tipo × estilo estaban vacíos**,
porque las familias se agrupaban por «carácter» y cada tipo usaba ocho.

- **Las familias pasan a ser POR ESTILO**: 4 familias × 11 estilos = 44
  direcciones de arte (letras, ornamento, textura, ritmo, transición,
  partículas, motivo, esquinas, fondo vivo, entrada y apertura). Cada tipo
  recorre los estilos que le corresponden (`CATEGORIAS_POR_TIPO`) con
  **20 diseños por estilo** (4 familias × 5 portadas). Total: **1 960**.
- **Lo que no aplica, no se ofrece**: un corporativo no muestra «infantil»
  ni «romántica», una boda no muestra «infantil». La galería calcula los
  chips con el tipo elegido y oculta los estilos sin diseños; antes
  aparecían y se abrían vacíos.
- **El mismo estilo, en el idioma de la ocasión** (`ajustarAlTipo`): una
  «carta» elegante lleva ramos y pétalos en una boda, pero en un evento de
  empresa o una graduación esos adornos se cambian por laurel, déco y
  destellos; un bautizo «infantil» pierde los dinosaurios y el confeti.
- **La foto de ambiente es del TIPO, no de la familia** (`FOTOS_TIPO`, 4 por
  tipo, ids verificados): en un corporativo salían rosas. Y cada portada
  pone la foto donde le luce —a pantalla completa, en el arco, en la
  tarjeta o de ambiente—: las que tienen hueco salían con un degradado gris.
- **El catálogo se consulta paginado y liviano**: `catalogoPlantillas`
  (filtra por tipo y estilo, `range`) y `conteosPorCategoria`. Antes se
  traían todas las filas con el documento completo y PostgREST cortaba en
  1 000 → los conteos salían mal («Editorial 11»). Para las tarjetas
  alcanza con `estilos` + la portada (`esquema->secciones->0`); el
  documento entero se pide al elegir. Los filtros viven en la URL
  (`?estilo=&tipo=&ver=`), así se comparten y el «atrás» funciona.
- El sembrador **apaga** (no borra) las plantillas de catálogos anteriores
  y ahora pagina al leer la tabla (antes dejaba encendidas las que pasaban
  de la fila 1 000).

Verificación: eslint 0 · vitest **3 473** · `npm run build` OK · 1 960
plantillas activas · capturas de Elegante/Luxury + Corporativos, Boda +
Moderna, XV + Editorial, Bautizo + Infantil y Graduación + Floral.

### Vista previa de las plantillas (22 sep, mañana)
Las tarjetas del catálogo solo mostraban la portada. Ahora cada una tiene
**«Ver»** junto a «Usar esta» (en el catálogo del panel y en el selector del
editor), que abre en otra pestaña `/celebrar/plantillas/<slug>`: la
invitación completa —apertura incluida— con datos de muestra por tipo
(`lib/celebrar/muestras.ts`), y una barra con «Volver al catálogo» y «Usar
este diseño». Es pública: sirve también para compartirle un diseño a
alguien. Nada se guarda; al usarla, el editor la rellena con los datos
reales de la celebración.

De paso, el velo de color sobre la foto de portada pasó de 0,55 parejo a un
degradado (0,30 arriba → 0,93 donde cae el texto): las portadas con foto de
ambiente salían lavadas.

### 45 aperturas distintas (22 sep, tarde)

El dueño: «NO TODAS LAS INVITACIONES TENGAN LA MISMA ANIMACIÓN O ENTRADA,
TODAS SON REPETITIVAS… AL MENOS 45 TIPOS DIFERENTES DE ENTRADAS».

Ahora `estilo.apertura` tiene **45 mecánicas + «directa»**, agrupadas en
cinco familias (`GRUPOS_APERTURA` en `lib/celebrar/invitacion/esquema.ts`),
que es como se eligen en el editor:

| Familia | Aperturas |
| --- | --- |
| Papel | sobre, sobre_cera, carta_doblada, pergamino, postal, libro, diptico, abanico, sobre_desliza, funda |
| Telones | telon, telon_alto, persiana, persiana_v, puertas, iris, cremallera, mosaico, damero, franjas |
| Luz | destello, flash, amanecer, rayo, chispas, fuegos, purpurina, halo |
| Partículas | petalos, confeti, humo, burbujas, hojas, nieve, arena, estrellas |
| Movimiento | zoom, giro, ondas, ripple, pixeles, glitch, espiral, corte, rebote |

**Cómo está armado.** Un solo componente
(`componentes/celebrar/invitacion/apertura-invitacion.tsx`) con un mapa
`CONFIG`: cuántas PIEZAS lleva el telón, qué ADORNO va al centro (sobre,
papel, monograma) y cuántas PARTÍCULAS. El CSS decide cómo se va cada cosa,
así que cada apertura cabe en dos o tres líneas en vez de en un componente
propio. El catálogo reparte una distinta por familia de plantilla
(`APERTURAS_POR_ESTILO` en el generador): las 1 960 plantillas usan las 45,
y dentro de un mismo estilo+tipo hay al menos 10 diferentes.

Para probar cualquiera sin crear una celebración:
`/celebrar/demos/<demo>?apertura=<id>`.

**Tres cosas que estaban mal y se arreglaron en esta pasada:**

- La capa que contiene las piezas se llamaba `inv-ap-telon`, **igual que la
  apertura «telón»**, así que sus reglas (ancho 50,5 %, `left` por
  `nth-child`) se aplicaban a las 45: las láminas salían a media pantalla y
  descuadradas. La capa ahora es `inv-ap-capa`.
- Las rejillas (mosaico, damero, píxeles) calculaban fila y columna con
  `floor()`, que **no existe en CSS** → la declaración entera se caía. La
  columna y la fila llegan calculadas desde el componente (`--c`, `--f`).
- Las partículas tenían la posición y el retraso atados al índice, así que
  caían en fila india, en diagonal. Ahora cada una recibe su sitio, su
  deriva, su tamaño, su giro y su retraso de un **azar determinista**
  (`azar(i, semilla)`, el mismo en servidor y cliente: no rompe la
  hidratación).

**Detalles de acabado.** Cada pieza lleva un filo claro (una lámina del
color del fondo no se ve moverse); las de una sola lámina (zoom, ripple,
iris, rebote, ondas, corte, glitch) llevan un halo, y la espiral, rayos
cónicos; las de dos hojas, una junta dorada en el medio. Las calmadas
—pétalos, hojas, nieve, arena, burbujas— **ya están cayendo antes del
toque** y siguen cayendo mientras la capa se desvanece: reiniciarlas al
abrir las mandaba fuera de pantalla justo cuando había que verlas. Las de
fiesta (confeti, purpurina, fuegos, chispas, rayo) sí estallan al abrir, y
las estrellas titilan quietas y se van hacia arriba.

Verificación: `tsc` limpio · eslint 0 · vitest **3 473** · `npm run build`
OK · hoja de contacto de las 45 (cerrada y a media animación) revisada una
por una.
