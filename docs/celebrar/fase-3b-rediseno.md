# CELEBRAR — Fase 3b: las invitaciones al estándar de Bookea

> Hecha el 21 de setiembre de 2026, en local (`localhost:3100`), tras la
> devolución del dueño: «esos diseños están muy feos… que sean como los
> que ya Bookea tiene hechos» y «todo súper diseñable, con el panel de
> secciones a la derecha» (referencia: fiestly.com). **Sin commit, sin
> deploy.** No hubo migración nueva: el `Documento` es jsonb y se
> normaliza; las 440 plantillas se **re-sembraron** con el mismo script.

## Lo que cambió, en una línea

La invitación dejó de ser una lista de bloques sobre un color y pasó a
ser lo que son las demos de `/i/*` de Bookea: **una experiencia a
pantalla completa contada por escenas** — portada que llena el
teléfono, capítulos que alternan marfil y vino con bordes ondulados,
ornamentos, texturas, fondos que se mueven, pétalos cayendo, fecha
monumental con esquinas, cuenta regresiva en celdas, polaroids, cartas
de vestimenta, línea de tiempo, cierre con la firma en grande.

## El renderizador (`components/celebrar/invitacion/`)

| Pieza | Qué hace |
|---|---|
| `invitacion.css` | La hoja de estilos de la invitación. Mide en **`cqi`** (ancho del contenedor), así la previa de 390 px del editor es idéntica al teléfono aunque el navegador mida 1920. Escenas, tipografía, botones pill, cartas, fecha monumental, cuenta regresiva, línea de tiempo, polaroids, vestimenta, FAQ, cierre, partículas, entradas al scroll, fondos vivos, herramientas del editor |
| `render-invitacion.tsx` | Arma las escenas con su tono (fondo / escena según el `ritmo` y el diseño propio de cada sección), su borde con la anterior, su textura, su fondo vivo y sus partículas (portada y cierre). `modo="editor"` muestra pistas y secciones apagadas atenuadas; `soloPortada` para miniaturas; `altoPantalla` fija «una pantalla»; `edicion` conecta la selección con el panel |
| `escena.tsx` (cliente) | Cada sección: IntersectionObserver → `data-vista` dispara las entradas (`.inv-rev`, sumerge, brinco, lado, crece). En el editor es tocable: marco punteado, píldora con el nombre, botones ocultar y «Aa» |
| `ornamentos.tsx` | Ornamentos bajo los títulos (línea, diamante, floritura, estrella, corazón, anillos, ramita), bordes entre escenas (ondas, festón, diagonal, curva) e íconos de línea |
| `fondo-vivo.tsx` | Fondos animados: ondas que se mecen (3 capas SVG), aurora, degradado en movimiento, círculos flotando, destello que barre, líneas a la deriva, malla. Intensidad y velocidad. Solo transform/opacity |
| `particulas.tsx` | Pétalos, hojas, confeti, destellos, estrellas, burbujas: posiciones deterministas (misma semilla en servidor y cliente), 18 en la portada y 10 en el cierre |
| `cuenta-regresiva.tsx` | Cuatro celdas con borde, en la letra del título |
| `decoracion.ts` | Los motivos (hojas, flores, confeti…) ahora como capa por escena en el color suave |

La marca del sitio (`celebrar.css`) ya **no le impone Montserrat a los
títulos de la invitación**: `.celebrar :is(h1,h2,h3):not(.inv *)`.

## El `Documento` creció (compatible hacia atrás)

`lib/celebrar/invitacion/esquema.ts` — todo con valor por defecto, así
un documento viejo se ve como antes:

- **Paleta**: `escena` y `tintaEscena` (el segundo color). Las 88 paletas
  de `paletas.ts` los traen; el test exige contraste ≥ 4,5.
- **Estilo**: `ornamento`, `textura` (lisa, seda, papel, viñeta, grano),
  `ritmo` (uniforme, alternar, escena), `transicion` (recta, ondas,
  festón, diagonal, curva), `particulas`, `marco` (filete), `fondoVivo` +
  `fondoIntensidad` + `fondoVelocidad`.
- **Secciones**: nueva `itinerario` (programa del día); `dress_code` con
  `grupos` (Caballeros/Damas) y `colores` (paleta sugerida); `regalos`
  con `sinpe`.
- **Diseño propio de cada sección** (`seccion.diseno`): `tono`
  (auto/fondo/escena), `fondoUrl` (foto de fondo con velo), `alineacion`,
  `tamano` (compacta/normal/pantalla completa), `ornamento`, `fondoVivo`
  (auto o uno propio).

## Las 440 plantillas, por familias

`plantillas/generador.ts` ya no combina índices: define **8 familias por
carácter** (elegante, moderno, alegre, formal), cada una con dirección
de arte completa — letras, ornamento, textura, ritmo, borde, partículas,
motivo, marco, bordes, fondo vivo y sus cinco portadas. La familia k usa
la paleta k del tipo; la variante decide la portada (la quinta es la
versión quieta). 8 × 5 = 40 por tipo, intercaladas para que el catálogo
no muestre cinco tarjetas seguidas del mismo color. Nombres, categorías
y premium (cada cuarta, 30 créditos) como antes.

Ejemplos: *Carta* (Playfair, diamante, seda, alternar, ondas, pétalos,
fondo de ondas), *Gala* (Cinzel, viñeta, filete, destellos), *Jardín*
(Cormorant, ramita, papel, hojas, aurora), *Neón* (Bebas, grano,
degradado en movimiento), *Fiesta* (Fredoka, festón, confeti).

Re-sembradas con `npx tsx scripts/celebrar-sembrar-plantillas.mts`
(upsert por slug). Las miniaturas del catálogo ahora son **la portada
real** renderizada a 390 px y encogida (`miniatura-plantilla.tsx`, con
ResizeObserver), no un dibujo aproximado.

## El editor

- **Secciones** (`panel-secciones.tsx`), como la referencia: tarjeta por
  sección con ícono, nombre, etiqueta Básico/Pro, «Editar», flechas,
  interruptor; la activa se abre ahí mismo con dos pestañas —
  **Contenido** (sus campos, incluidos itinerario, grupos y colores de
  vestimenta, SINPE) y **Diseño de esta sección** (tono, foto de fondo,
  alineación, aire, fondo vivo, ornamento) — y «Siguiente sección →».
  Las apagadas se ven grises («Tocá para prenderla y editar»).
- **Selección compartida**: tocar una escena en el teléfono la abre en
  el panel y la resalta (marco punteado + píldora con el nombre + botones
  ocultar / «Aa»); abrir una tarjeta en el panel la trae a la vista en el
  teléfono. Dentro del editor los links de la invitación no navegan.
- **Estilo** (`panel-estilo.tsx`): paleta con escena (y los 7 colores a
  mano), escenas y borde, tipografía, portada (miniaturas reales),
  ornamento (con su dibujo), fondo vivo + intensidad + velocidad,
  textura, partículas, motivo, bordes, filete, animaciones.
- La previa pasa `altoPantalla` = alto de la pantalla del teléfono, así
  la portada «llena una pantalla» de verdad.
- **Todo es gratis por ahora**: las etiquetas Pro son solo rótulo; qué se
  cobra se decide en la Fase 4.

## La portada (`/celebrar`)

«Para lo que estén celebrando» es ahora un **carrusel de tarjetas con
foto** (`carrusel-tipos.tsx`): scroll nativo con snap, avanza solo cada
3,6 s, se arrastra con el dedo o el mouse, flechas e indicador; se
detiene al tocarlo, con el cursor encima, fuera de pantalla y con
`prefers-reduced-motion`. Las fotos son de Unsplash con ids verificados
a mano (`lib/celebrar/fotos-tipos.ts`); `images.unsplash.com` ya estaba
permitido en `next.config`.

## Verificaciones

- `tsc` limpio · eslint 0 avisos · vitest 3448 en verde (nuevos tests:
  contraste de escena, familias, compatibilidad de documentos viejos) ·
  `npm run build` pasa.
- En el navegador: selector con las portadas reales y sus letras;
  aplicar *Marfil* (familia Carta) → portada a pantalla completa con
  pétalos y «Deslizá ↓» → capítulo en vino con borde de ondas → fecha
  monumental con esquinas y «Agregar al calendario» → celdas de la
  cuenta → programa en línea de tiempo → vestimenta en cartas → cierre
  con la firma. Selección desde el teléfono y desde el panel; diseño
  propio de una sección (fondo, izquierda, pantalla completa) aplicado y
  revertido; los 7 fondos vivos probados sobre *Jardín Secreto*.
- El carrusel avanza solo (scrollLeft 144 → 632), se arrastra con el
  mouse sin abrir el link, y las 10 fotos cargan.

## Pendiente / notas

- **Música** (la «canción» de las demos de Bookea) no está: necesita
  subir audio y un reproductor; queda para cuando se defina el add-on.
- **Sobre lacrado / intro** de pantalla completa: tampoco; es un
  «héroe» más a agregar (`HEROES`) cuando se quiera.
- La foto de fondo por sección y la portada de foto llevan velo oscuro
  fijo; si se quiere claro, sería un campo más del diseño de sección.
- Las plantillas viejas que alguien hubiera aplicado antes del rediseño
  (solo la demo «Sofía & Andrés») se ven como antes hasta que se
  reaplica una plantilla o se tocan los controles nuevos.
