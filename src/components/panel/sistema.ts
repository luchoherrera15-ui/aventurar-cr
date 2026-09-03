/**
 * ═══════════════════════════════════════════════════════════════════
 *  EL SISTEMA DE DISEÑO DE LOS PANELES DE BOOKEA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Un solo lugar donde viven las decisiones visuales del panel del
 * dueño (`/mi-negocio`), del panel de lealtad (`/lealtad/panel`) y de
 * la cuenta (`/cuenta`): superficies, radios, elevación, la anatomía
 * de una tarjeta y su encabezado, la escala tipográfica y los estados.
 *
 * ── CÓMO SE USA ────────────────────────────────────────────────────
 * Son CLASES (strings de Tailwind) y no componentes con veinte props,
 * por la misma razón que ya explicaba `tarjeta-dato.ts`: cada pantalla
 * arma su layout y toma de acá el color, la elevación y la escala. Las
 * piezas armadas (Card, Metrica, FilaPanel…) viven en `./piezas.tsx` y
 * están construidas con estas mismas constantes.
 *
 * ── POR QUÉ ES UN MÓDULO NEUTRO ────────────────────────────────────
 * Sin `"use client"` y sin importar nada de React: lo consumen tanto
 * `page.tsx` (servidor) como los paneles interactivos (cliente).
 * Exportar un helper desde un módulo cliente da un 500 invisible al
 * build — ya rompió Finanzas y el panel de IA. Por eso acá no hay JSX
 * ni hooks, solo texto.
 *
 * ── DE DÓNDE SALE ──────────────────────────────────────────────────
 * De `referencia/bookeapaneles.html`, la maqueta que pidió el dueño.
 * De ella se copia la ANATOMÍA (lienzo gris + tarjeta blanca con borde
 * y sombra doble tenue, encabezado con kicker + título + acción a la
 * derecha, fila de listado con barrita de color, píldora de estado);
 * NO se copian ni sus tamaños —está dibujada a escala reducida, con
 * rótulos de 8px— ni sus colores, que no pasan la auditoría WCAG que
 * el sitio acaba de aprobar. Los reemplazos están medidos abajo.
 *
 *
 * ═══════════════════════════════════════════════════════════════════
 *  CONTRASTE MEDIDO (WCAG 2.x — AA: 4,5:1 texto normal · 3:1 texto
 *  grande y elementos gráficos). Ratios calculados sobre los hex
 *  reales; todos los pares son SÓLIDOS, ninguno depende de lo que
 *  haya detrás.
 * ═══════════════════════════════════════════════════════════════════
 *
 * LOS TRES COLORES DE LA MAQUETA QUE NO SE PUEDEN COPIAR
 *   --muted   #718096 sobre blanco ........ 4,01:1 ✗ → usamos #585858
 *   --orange  #ff7a1a sobre blanco ........ 2,61:1 ✗ → usamos #a83f00
 *   --accent  #1f9d78 como TEXTO en blanco  3,41:1 ✗ → usamos la
 *             `tinta` del acento del tipo (ver más abajo)
 *
 * EL LIENZO Y LA TARJETA
 *   tarjeta #ffffff sobre lienzo #f6f6f6 ......... 1,08:1
 *     No es un par de texto: es la separación entre dos superficies.
 *     La maqueta hace exactamente lo mismo (#fff sobre #f5f7fa =
 *     1,07:1) y la lectura la terminan de resolver el borde y la
 *     sombra. ESTE ES EL CAMBIO QUE HACE QUE EL PANEL SE VEA PANEL:
 *     antes el lienzo era blanco, o sea tarjeta blanca sobre blanco
 *     (1:1), y por eso todo se veía plano.
 *   borde --line #e2e2e2 sobre blanco ........... 1,30:1
 *     Separador, NO portador de estado. Ningún estado del sistema se
 *     comunica solo con el borde: siempre hay además texto, o una
 *     barrita de color medida contra el fondo de la tarjeta.
 *
 * TEXTO
 *   --text #161616 sobre tarjeta blanca ......... 18,10:1 ✅ AAA
 *   --text #161616 sobre lienzo #f6f6f6 ......... 16,75:1 ✅ AAA
 *   --muted #585858 sobre tarjeta blanca ........  7,12:1 ✅ AA
 *   --muted #585858 sobre lienzo #f6f6f6 ........  6,58:1 ✅ AA
 *   --navy #16295e sobre tarjeta blanca ......... 13,88:1 ✅ AAA
 *   --orange-fuerte #a83f00 sobre blanco ........  6,22:1 ✅ AA
 *   --orange-fuerte #a83f00 sobre #f6f6f6 .......  5,76:1 ✅ AA
 *     (el kicker/eyebrow: es el papel que la maqueta le da al naranja,
 *      con el único naranja nuestro que se puede leer sobre claro)
 *
 * LA COLUMNA NAVY
 *   blanco sobre --navy #16295e ................. 13,88:1 ✅ AAA
 *   --color-aventurea-rail #9fb0cf sobre #22397c   4,93:1 ✅ AA
 *   --color-aventurea-rail #9fb0cf sobre #16295e   6,33:1 ✅ AA
 *     El reemplazo sólido de `text-white/60`, medido contra los DOS
 *     extremos del degradé del rail. El porqué está en globals.css.
 *
 * LOS ESTADOS (píldora = fondo tenue + letra oscura; marca = la
 * barrita/punto de 4px, que es un elemento gráfico y necesita 3:1
 * contra la tarjeta blanca)
 *   éxito   letra #1f7a4d sobre #e1f0e6 .......... 4,51:1 ✅ AA
 *           marca #1f7a4d sobre blanco ........... 5,32:1 ✅
 *   aviso   letra amber-800 #92400e sobre #fffbeb  6,84:1 ✅ AA
 *           marca amber-600 #d97706 sobre blanco . 3,19:1 ✅
 *   info    letra --navy #16295e sobre #e8f0f9 ... 12,07:1 ✅ AAA
 *           marca #3b7fc4 sobre blanco ........... 4,18:1 ✅
 *   neutro  letra --muted #585858 sobre #f6f6f6 ..  6,58:1 ✅ AA
 *           marca #585858 sobre blanco ........... 7,12:1 ✅
 *   alerta  letra red-700 #b91c1c sobre #fef2f2 ..  5,91:1 ✅ AA
 *           marca red-600 #dc2626 sobre blanco ... 4,83:1 ✅
 *
 * EL ACENTO POR TIPO DE NEGOCIO (`variablesAcento()`, identidad.ts)
 *   Entra UNA vez en el contenedor del panel y acá se lee siempre como
 *   `var(--acento…)`: ni un hexadecimal suelto. Sus ratios ya están
 *   medidos y probados en `identidad.ts` / `identidad.test.ts`, para
 *   los ocho acentos del catálogo:
 *     `tinta` sobre blanco ............ de 6,22:1 a 14,89:1 ✅ AA
 *     `tinta` sobre `suave` ........... de 5,56:1 a 12,78:1 ✅ AA
 *     `sobreSolido` sobre `solido` .... de 5,18:1 a 12,70:1 ✅ AA
 *   Como el contraste es simétrico, `solido` contra blanco es ese
 *   mismo ≥5,18:1 — de sobra para el 3:1 de una barrita o un disco.
 *   REGLA: el acento marca ESTADO, ACCIÓN y DISCO DE ÍCONO. Nunca es
 *   un color genérico de decoración.
 *
 * ── PROHIBIDO ──────────────────────────────────────────────────────
 * · Alfas para marcar un estado (`text-white/60`, `bg-white/[.06]`,
 *   `ring-white/60`): el mismo estado se ve de dos colores según el
 *   fondo y su contraste no se puede medir una sola vez.
 * · Hexadecimales nuevos. Todo sale de globals.css o de identidad.ts.
 * · El círculo decorativo de `.metric:after` de la maqueta. Ya lo
 *   sacamos una vez y el porqué está en `tarjeta-dato.ts`: pasaba por
 *   detrás del número, o sea un adorno compitiendo con el único dato
 *   de la tarjeta.
 * · Rellenar una tarjeta con una cifra que no tiene tabla detrás.
 *   Preferimos una tarjeta menos a una que miente.
 */

// ───────────────────────────────────────────────────────────────────
//  1 · SUPERFICIES Y ELEVACIÓN
// ───────────────────────────────────────────────────────────────────

/**
 * EL LIENZO DEL PANEL. Va en el contenedor de la pantalla entera.
 *
 * `--grey` (#f6f6f6), no `--bg` (#ffffff): una tarjeta blanca sobre un
 * lienzo blanco no existe, y eso es literalmente lo que se veía. No es
 * un color nuevo — es el gris de fondo que el sistema ya usa para las
 * superficies hundidas.
 */
export const LIENZO_PANEL = "bg-aventurea-cream-2";

/**
 * LA TARJETA. Fondo blanco + borde de 1px + la elevación del sistema.
 *
 * La maqueta usa una sombra doble azulada muy tenue
 * (`0 2px 3px rgba(24,42,69,.025), 0 12px 34px rgba(24,42,69,.035)`);
 * nuestro `--shadow-elevado` ya es exactamente esa idea con el azul de
 * marca, así que se usa ese token en vez de inventar una receta nueva.
 * El radio NO lo pone esta constante: lo pone `RADIO_*`, porque la
 * misma superficie se usa en tarjeta (18px) y en métrica (14px).
 */
export const SUPERFICIE_PANEL =
  "border border-aventurea-line bg-aventurea-surface shadow-elevado";

/**
 * LA SUPERFICIE HUNDIDA: lo que va DENTRO de una tarjeta y tiene que
 * leerse como un escalón más abajo (el panel del día del calendario,
 * el fondo de un módulo, una caja de detalle). Es el `#f8fafc` de la
 * maqueta, con nuestro gris.
 */
export const SUPERFICIE_HUNDIDA = "border border-aventurea-line bg-aventurea-cream-2";

// ───────────────────────────────────────────────────────────────────
//  2 · RADIOS Y ESPACIADO
// ───────────────────────────────────────────────────────────────────

/**
 * Los radios de la maqueta mapeados a la escala de la marca, que ya
 * está definida en globals.css y compartida con la app móvil:
 *   .card 16px          → rounded-3xl (18)  bloques y secciones
 *   .metric 14px        → rounded-2xl (14)  calce exacto
 *   .module/.date 11px  → rounded-xl  (12)  botones, inputs, tiles
 *   .status/.badge 5-6  → rounded-lg  (8)   chips y píldoras
 */
export const RADIO_CARD = "rounded-3xl";
export const RADIO_METRICA = "rounded-2xl";
export const RADIO_TILE = "rounded-xl";
export const RADIO_PILDORA = "rounded-lg";

/**
 * El padding de una tarjeta: 19px en la maqueta, 15px por debajo de
 * 560px. Nuestro par más cercano de la escala de Tailwind.
 */
export const PADDING_CARD = "p-4 sm:p-5";

/**
 * Los huecos de la maqueta: 14px entre tarjetas de la grilla
 * (`.main-grid`, `.lower`, `.modules`) y 12px entre métricas.
 * Se exportan como clases para que ninguna pantalla invente el suyo.
 */
export const GAP_TABLERO = "gap-3.5";
export const GAP_METRICAS = "gap-3";

/**
 * LA GRILLA DEL TABLERO. La maqueta parte en
 * `minmax(0,1.72fr) minmax(260px,.78fr)` a partir de 780px: una
 * columna ancha (lo que se lee) y una angosta (lo que se decide).
 * Debajo de lg va a una sola columna, que es lo que necesitan los
 * 390px del teléfono.
 */
export const GRILLA_TABLERO = `grid grid-cols-1 lg:grid-cols-[minmax(0,1.72fr)_minmax(260px,0.78fr)] ${GAP_TABLERO}`;

/** La grilla de métricas: 2 columnas en teléfono SIEMPRE.
 *  Con tres, «₡12.500.000» queda en 87px útiles y se corta — y un
 *  monto no tiene dónde partirse. El porqué largo vive en
 *  `dashboard-metricas.tsx`, que es quien lo midió. */
export const GRILLA_METRICAS = `grid grid-cols-2 ${GAP_METRICAS} lg:grid-cols-4`;

// ───────────────────────────────────────────────────────────────────
//  3 · TIPOGRAFÍA
// ───────────────────────────────────────────────────────────────────
//
// La maqueta está dibujada a escala reducida (rótulos de 8px, ítems de
// menú de 10,5px) para que entre todo en una captura. NO se copia el
// tamaño: se copia la RELACIÓN entre los tamaños, escalada ~1,3× hasta
// los cuerpos que el panel ya usaba. La familia también es la nuestra
// (Montserrat/Figtree), no la Inter de la maqueta.

/** El kicker de una tarjeta o de una pantalla («AGENDA DE HOY»). Es el
 *  único lugar donde el naranja de marca sigue vivo en el panel, y va
 *  en `--orange-fuerte` porque el naranja del logo no se lee sobre
 *  claro (2,61:1). 6,22:1 sobre blanco. */
// Azul y no naranja desde sep 2026 (pedido del dueño: «el panel es
// blancos y azules — un CRM»). `bookea-azul` es var(--navy), así que
// dentro de `.lealtad` hereda el navy del módulo solo.
export const EYEBROW =
  "text-[11px] font-extrabold uppercase leading-none tracking-[0.14em] text-bookea-azul";

/** El mismo kicker cuando NO habla de marca sino de contexto (la fecha
 *  de hoy, «3 pendientes»): gris de texto, para no tener media pantalla
 *  en naranja. 7,12:1 sobre blanco. */
export const EYEBROW_NEUTRO =
  "text-[11px] font-bold uppercase leading-none tracking-[0.14em] text-aventurea-ink-soft";

/** El h1 de una pantalla del panel. `clamp(24,2.2vw,34)` en la maqueta. */
export const TITULO_PANTALLA =
  "titulo text-[26px] leading-[1.1] tracking-tight text-aventurea-navy sm:text-[32px]";

/** La bajada del h1. */
export const BAJADA_PANTALLA = "text-[13.5px] leading-relaxed text-aventurea-ink-soft";

/** El h2 de una tarjeta (`.card-head h2`, 15px en la maqueta). */
export const TITULO_CARD =
  "titulo text-[18px] leading-tight tracking-[-0.02em] text-aventurea-navy";

/** La cifra de una métrica (`.metric strong`, 23px). `tabular-nums` es
 *  lo que hace que una columna de montos no baile de ancho. */
export const CIFRA =
  "text-[18px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-aventurea-ink sm:text-[22px]";

/** El rótulo de una métrica (`.metric p`). */
export const ROTULO_CIFRA =
  "text-[10.5px] font-bold uppercase leading-tight tracking-wide text-aventurea-ink-soft sm:text-[11px]";

/** El detalle bajo la cifra (`.metric small`). */
export const DETALLE = "text-[11.5px] leading-snug text-aventurea-ink-soft sm:text-[12px]";

/** El cuerpo de una fila o de un párrafo dentro de una tarjeta. */
export const CUERPO = "text-[13.5px] leading-relaxed text-aventurea-ink";

/** El dato secundario de una fila (`.appt-person small`). */
export const CUERPO_SUAVE = "text-[12px] leading-snug text-aventurea-ink-soft";

/** El enlace de texto del extremo derecho de un `card-head`
 *  (`.link-btn`: «Ver agenda completa →»). */
export const ENLACE_CARD =
  "shrink-0 text-[12.5px] font-bold text-aventurea-navy hover:underline";

// ───────────────────────────────────────────────────────────────────
//  4 · BOTONES
// ───────────────────────────────────────────────────────────────────

/** `.btn` de la maqueta: 38px de alto, radio 9, borde, fondo blanco. */
export const BOTON_PANEL =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-surface px-4 text-[13px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-50";

/** `.btn.primary`: relleno navy, letra blanca (13,88:1). */
export const BOTON_PANEL_PRIMARIO =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-aventurea-navy px-4 text-[13px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50";

/** El botón cuadrado de ícono (las flechas de mes del calendario, el
 *  cerrar de un cajón). 36px, con ícono de verdad — no un «‹» de
 *  texto, que es lo que había. */
export const BOTON_ICONO =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-aventurea-line bg-aventurea-surface text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-50";

/** `.add-slot`: la acción de agregar, con marco punteado. */
export const BOTON_AGREGAR =
  "flex w-full items-center justify-center rounded-xl border border-dashed border-aventurea-line bg-transparent px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft transition-colors hover:border-aventurea-navy hover:text-aventurea-navy";

// ───────────────────────────────────────────────────────────────────
//  5 · LOS ESTADOS
// ───────────────────────────────────────────────────────────────────

/**
 * Los cinco estados del panel. Son semánticos a propósito (qué
 * significa, no de qué color es): así una reserva confirmada y un pago
 * recibido se pintan igual en las nueve pantallas, y cambiar el verde
 * es un solo renglón.
 *
 * `acento` NO está en esta lista: el acento es del TIPO DE NEGOCIO, no
 * un estado. Donde una pantalla quiera marcar «esto es tuyo / esto
 * está activo» con el color del rubro, usa `MARCA_ACENTO` de abajo.
 */
export type EstadoPanel = "exito" | "aviso" | "info" | "neutro" | "alerta";

/**
 * LA PÍLDORA DE ESTADO (`.status` de la maqueta): fondo tenue + letra
 * oscura. Ratios de letra sobre fondo, medidos arriba:
 * 4,51 · 6,84 · 12,07 · 6,58 · 5,91 — los cinco pasan AA.
 *
 * La maqueta le pone además un borde del mismo tinte; acá solo lo lleva
 * `neutro`, y con el token sólido `--line`. En los otros cuatro el
 * borde tendría que ser un alfa del propio tinte, y un alfa —aunque sea
 * decorativo— es justo lo que la auditoría dejó afuera. El tinte del
 * relleno más la letra oscura ya despegan la píldora de la tarjeta; el
 * borde transparente está solo para que las cinco midan igual de alto.
 */
export const ESTADO_PILDORA: Record<EstadoPanel, string> = {
  exito: "border border-transparent bg-aventurea-green-light text-aventurea-green",
  aviso: "border border-transparent bg-amber-50 text-amber-800",
  info: "border border-transparent bg-aventurea-blue-light text-bookea-azul",
  neutro: "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink-soft",
  alerta: "border border-transparent bg-red-50 text-red-700",
};

/**
 * LA MARCA (`.mark` de la maqueta): la barrita de 4px de la izquierda
 * de una fila, el punto de una leyenda, el relleno de una barra de
 * progreso. Es un ELEMENTO GRÁFICO, así que el piso es 3:1 contra la
 * tarjeta blanca — por eso el ámbar es el 600 y no el 500 (2,15:1) y
 * el neutro es el gris de texto y no `--line` (1,30:1).
 */
export const ESTADO_MARCA: Record<EstadoPanel, string> = {
  exito: "bg-aventurea-green",
  aviso: "bg-amber-600",
  info: "bg-aventurea-blue",
  neutro: "bg-aventurea-ink-soft",
  alerta: "bg-red-600",
};

/** La superficie tenue del estado, para un aviso a ancho completo
 *  dentro de una tarjeta (`.notice` de la maqueta). Mismos rellenos y
 *  mismas letras que la píldora, así que un aviso y su píldora se
 *  reconocen entre sí; solo cambia `neutro`, que en un párrafo largo
 *  necesita la tinta fuerte (16,75:1) y no el gris. */
export const ESTADO_AVISO: Record<EstadoPanel, string> = {
  exito: "bg-aventurea-green-light text-aventurea-green",
  aviso: "bg-amber-50 text-amber-800",
  info: "bg-aventurea-blue-light text-bookea-azul",
  neutro: "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink",
  alerta: "bg-red-50 text-red-700",
};

// ───────────────────────────────────────────────────────────────────
//  6 · EL ACENTO DEL TIPO DE NEGOCIO
// ───────────────────────────────────────────────────────────────────
//
// Se devuelven objetos de estilo en vez de clases porque el acento
// llega como variables CSS y no como utilidades de Tailwind. Son
// `Record<string,string>` —igual que `variablesAcento()`— para que este
// módulo no tenga que importar tipos de React.

/** El disco de ícono de una métrica o de un módulo (`.metric-ico`,
 *  `.module-ico`): fondo `suave`, ícono en `tinta`. ≥5,56:1 en los
 *  ocho acentos del catálogo. Los fallbacks existen para que la pieza
 *  no quede sin fondo si alguien la usa fuera del panel. */
export const DISCO_ACENTO: Record<string, string> = {
  backgroundColor: "var(--acento-suave, var(--grey))",
  color: "var(--acento, var(--navy))",
};

/** La marca del acento: la barrita del ítem activo del menú, la barra
 *  de un día vendido en el calendario, el relleno de un progreso.
 *  `solido` contra blanco es ≥5,18:1 (simétrico del par medido en
 *  identidad.ts), de sobra para el 3:1 de un elemento gráfico. */
export const MARCA_ACENTO: Record<string, string> = {
  backgroundColor: "var(--acento-solido, var(--navy))",
};

/** La superficie tenue del acento: la celda de un día vendido, el
 *  fondo de una pastilla del tipo de negocio. Encima va SIEMPRE
 *  `--acento` o `--text`, nunca `--acento-solido`. */
export const SUPERFICIE_ACENTO: Record<string, string> = {
  backgroundColor: "var(--acento-suave, var(--grey))",
};

/** El botón de acción del acento (`sobreSolido` sobre `solido`,
 *  ≥5,18:1). Es el papel que declara `Acento.solido` en identidad.ts. */
export const ACCION_ACENTO: Record<string, string> = {
  backgroundColor: "var(--acento-solido, var(--navy))",
  color: "var(--acento-sobre, #ffffff)",
};

// ───────────────────────────────────────────────────────────────────
//  6bis · EL TILE DE HERRAMIENTA (`.module` de la maqueta)
// ───────────────────────────────────────────────────────────────────

/**
 * La tarjetita de «Tus herramientas»: grilla ícono + copia + dato,
 * fondo hundido, y en hover pasa a blanco con el borde en el acento
 * del tipo. Es lo que hace que un consultorio no se vea como una
 * barbería sin cambiar una sola línea de layout.
 *
 * El borde de hover se pone con la variable del acento y no con una
 * clase, porque el color lo decide el tipo de negocio:
 *     className={TILE_PANEL} style={{ "--tile-hover": "var(--acento-solido)" }}
 * — en la práctica alcanza con `hover:border-aventurea-navy`, que es
 * lo que usa `AccesosModulos`: el acento ya está en el disco del ícono
 * y repetirlo en el borde satura la grilla.
 */
export const TILE_PANEL = `flex min-h-[72px] items-center gap-2.5 ${RADIO_TILE} border border-aventurea-line bg-aventurea-cream-2 p-2.5 text-left transition-colors hover:border-aventurea-navy hover:bg-aventurea-surface`;

/** La variante apagada: el módulo que el tipo declara y todavía no
 *  tiene pantalla. Marco punteado, sin fondo y sin nada que clickear. */
export const TILE_PANEL_APAGADO = `flex min-h-[72px] items-center gap-2.5 ${RADIO_TILE} border border-dashed border-aventurea-line bg-transparent p-2.5 text-left`;

// ───────────────────────────────────────────────────────────────────
//  7 · LA COLUMNA NAVY (el rail y su desplegable en el teléfono)
// ───────────────────────────────────────────────────────────────────

/** El ítem del menú en reposo. `text-aventurea-rail` es el sólido de
 *  4,93-6,33:1 que reemplaza al `text-white/60` de antes.
 *
 *  Rediseño sep 2026 (pedido del dueño: «textos más grandes, y el
 *  activo como una card mejor elaborada»): 38→46px de alto, 13→14px de
 *  letra — la misma escala que el rail de Lealtad ya estrenó el 31-ago
 *  (48px/14.5) para que pasar de un panel a otro no se sienta un
 *  salto. El `border-l-[3px]` transparente se queda: reserva los 3px
 *  para que el texto no se corra entre reposo y activo. */
export const RAIL_ITEM =
  "flex min-h-[46px] items-center gap-3 rounded-xl border-l-[3px] border-transparent px-3 py-2 text-[14px] font-bold transition-colors";

/** El ítem ACTIVO del rail, como CARD: superficie blanca elevada con
 *  la tinta navy — un par que no hay que medir (es el par base del
 *  sistema) — y la sombra azul del vocabulario (`shadow-elevado`). El
 *  color del rubro no desaparece: se muda al DISCO del ícono
 *  (`RAIL_DISCO_ITEM`), donde `--acento-solido`/`--acento-sobre` ya
 *  están medidos ≥5,18:1 (identidad.test.ts). Antes el relleno entero
 *  era el acento; la card blanca se ve más «panel profesional» y deja
 *  de teñir 40px de columna con el color del rubro. */
export const RAIL_ITEM_ACTIVO = "bg-white text-aventurea-navy shadow-elevado";

/** El disco del ícono del ítem activo (el acento del rubro lo pinta
 *  el llamador por `style`, con su par medido). */
export const RAIL_DISCO_ITEM =
  "grid h-8 w-8 shrink-0 place-items-center rounded-lg";

/** El rótulo de un grupo del menú (`.nav-label`). */
export const RAIL_GRUPO =
  "px-3 pb-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-aventurea-rail";

/** La cabecera de negocio del rail (`.business`). Fondo y borde
 *  translúcidos: acá el alfa SÍ se permite porque es una superficie
 *  decorativa sobre un fondo conocido y controlado (el degradé del
 *  rail), no un estado ni un texto. */
export const RAIL_TARJETA = "rounded-xl border border-white/10 bg-white/[0.07] p-2.5";

// ───────────────────────────────────────────────────────────────────
//  8 · LOS FORMULARIOS DEL PANEL
// ───────────────────────────────────────────────────────────────────

/** Un campo de texto/número/fecha. */
export const CAMPO_PANEL =
  "w-full rounded-xl border border-aventurea-line bg-aventurea-surface px-3 py-2.5 text-[13px] text-aventurea-ink";

/** Su rótulo. */
export const ROTULO_CAMPO = "text-[11.5px] font-bold text-aventurea-ink-soft";
