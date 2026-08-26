/**
 * ════════════════════════════════════════════════════════════════════
 *  EL FONDO DE LA TIRA — un cálculo, dos pintores
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (ago 2026): «poder customizar completamente la
 * tarjeta, que tengamos tipo algunos fondos con degradados o cosas así».
 *
 * ── HASTA DÓNDE LLEGA, QUE CONVIENE SABERLO ACÁ ─────────────────────
 *
 * Un pase de Apple acepta TRES colores planos y nada más:
 * `backgroundColor`, `foregroundColor` y `labelColor`. No existe ninguna
 * clave que acepte un degradado, y `background.png` —lo único que
 * pintaría la tarjeta entera— no aplica a un `storeCard`: es de
 * `eventTicket`, y ahí sería excluyente con la franja. O sea que
 * ganaríamos el fondo y perderíamos los sellos.
 *
 * El ÚNICO lienzo libre de una tarjeta de fidelidad es la franja
 * (`strip.png`, 375×123 puntos), que componemos nosotros con sharp. Este
 * módulo pinta ESA franja.
 *
 * ── POR QUÉ ARRANCA Y TERMINA EN EL COLOR DE LA TARJETA ─────────────
 *
 * El borde de arriba y el de abajo de la franja limitan con
 * `backgroundColor`, que es un color plano. Si un extremo del degradado
 * no coincide con él, aparece una LÍNEA DE CORTE en el teléfono del
 * cliente que no se ve en el monitor de nadie. Por eso las dos formas
 * abren y cierran en el color de la tarjeta: de lejos, la tarjeta entera
 * se lee como una sola pieza continua.
 *
 * ── POR QUÉ EL EJE ES SIEMPRE VERTICAL, Y NO ES CONFIGURABLE ────────
 *
 * iOS escala la franja al ancho del teléfono y la RECORTA a lo ancho
 * —nunca a lo alto—; el aviso está documentado en `layout-tira.ts` y por
 * eso el margen horizontal de los sellos tampoco se configura.
 *
 * Un degradado vertical llega IDÉNTICO a todos los teléfonos, píxel por
 * píxel. Uno diagonal, horizontal o radial pierde ~7 % de cada punta en
 * pantallas angostas: el dueño elegiría un color que su cliente no llega
 * a ver nunca, y la vista previa se lo mostraría igual.
 *
 * ⚠️ ESA DECISIÓN ES LA QUE HABILITA LOS DOS PINTORES DE ABAJO. Mientras
 * el eje sea vertical, `linear-gradient(to bottom, …)` de CSS y un
 * `<linearGradient x1="0" y1="0" x2="0" y2="1">` de SVG son la MISMA
 * especificación: mismo eje, mismas posiciones, misma interpolación. No
 * hay ángulo que traducir, así que no hay dos algoritmos.
 *
 * El día que alguien quiera ángulos, eso deja de ser cierto —`0deg` de
 * CSS y el vector de SVG son dos especificaciones distintas, con la
 * regla de la esquina mágica de por medio— y HAY QUE colapsar los dos
 * pintores en uno solo que sirva el mismo SVG a las dos puntas. Es el
 * mismo bug de «dos algoritmos para el mismo dibujo» que
 * `layout-tira.ts` vino a matar; no lo reintroduzcas por un ángulo.
 */

/** Las formas que se ofrecen. `plano` es el fondo de siempre. */
export type FormaFondo = "plano" | "resplandor" | "cascada";

export type FondoTira =
  | { forma: "plano" }
  | {
      forma: "resplandor" | "cascada";
      /** Primer acento del degradado. */
      acento: string;
      /** Segundo acento, opcional: da un degradado de tres paradas. */
      acento2: string | null;
    };

/** El fondo de todas las tarjetas emitidas hasta hoy. */
export const FONDO_CLASICO: FondoTira = { forma: "plano" };

/**
 * Un color que se puede meter dentro de un SVG (o de un `style`) sin
 * miedo.
 *
 * Los colores del pase salen de columnas de texto, y acá se concatenan
 * en MARKUP: un valor con una comilla cerraría el atributo y lo que
 * siguiera serían etiquetas.
 *
 * ⚠️ EL RESPALDO SIEMPRE TIENE QUE SER UN LITERAL. Pasarle como respaldo
 * otro valor que venga de la base rompe la invariante entera y deja
 * pasar markup por la puerta de atrás.
 *
 * Está duplicado a propósito respecto del `hexSeguro` de `imagenes.ts`:
 * ese archivo importa `sharp`, y este módulo NO importa nada —igual que
 * `layout-tira.ts`— justamente para que lo pueda usar un componente de
 * cliente. Es la misma regla de tres líneas, no una segunda verdad.
 */
export function hexSeguro(valor: string | null | undefined, respaldo: string): string {
  return typeof valor === "string" && /^#[0-9A-Fa-f]{6}$/.test(valor) ? valor : respaldo;
}

/** El navy de Bookea, para cuando no hay color guardado. */
const FONDO_POR_DEFECTO = "#002472";

export type Parada = { pos: number; color: string };

/**
 * LAS PARADAS DEL DEGRADADO — el único cálculo del fondo.
 *
 * Devuelve `null` para el fondo clásico, y eso es lo que mantiene
 * intacta cada tarjeta ya emitida: sin paradas no se agrega ninguna capa
 * y el PNG sale byte por byte igual al de ayer.
 */
export function paradasDelFondo(fondo: FondoTira, colorTarjeta: string): Parada[] | null {
  if (fondo.forma === "plano") return null;

  const base = hexSeguro(colorTarjeta, FONDO_POR_DEFECTO);
  // El respaldo del acento es `base`: un acento ilegible degrada a
  // «sin degradado visible», nunca a un color inventado.
  const a1 = hexSeguro(fondo.acento, base);
  const a2 = fondo.acento2 ? hexSeguro(fondo.acento2, a1) : null;

  if (fondo.forma === "resplandor") {
    // La luz en el medio, la tarjeta en los dos extremos.
    return a2
      ? [
          { pos: 0, color: base },
          { pos: 0.34, color: a1 },
          { pos: 0.6, color: a2 },
          { pos: 1, color: base },
        ]
      : [
          { pos: 0, color: base },
          { pos: 0.47, color: a1 },
          { pos: 1, color: base },
        ];
  }

  // Cascada: el acento arriba, entrando en el 8 % superior para que el
  // borde de arriba siga siendo el color de la tarjeta.
  return a2
    ? [
        { pos: 0, color: base },
        { pos: 0.08, color: a1 },
        { pos: 0.52, color: a2 },
        { pos: 1, color: base },
      ]
    : [
        { pos: 0, color: base },
        { pos: 0.08, color: a1 },
        { pos: 1, color: base },
      ];
}

/**
 * El fondo para sharp. `null` = fondo clásico, no se agrega capa.
 *
 * ⚠️ INVARIANTE AUDITABLE: acá no se interpola NADA que no haya pasado
 * por `hexSeguro` con respaldo literal, o que no sea un número formateado
 * con `toFixed()`. Es la única barrera contra inyección de markup, y
 * tiene que poder comprobarse leyendo estas diez líneas.
 */
export function svgDelFondo(
  fondo: FondoTira,
  colorTarjeta: string,
  ancho: number,
  alto: number,
): string | null {
  const paradas = paradasDelFondo(fondo, colorTarjeta);
  if (!paradas) return null;
  const stops = paradas
    .map((p) => `<stop offset="${p.pos.toFixed(3)}" stop-color="${p.color}"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(ancho)}" height="${Math.round(alto)}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient></defs>` +
    `<rect width="${Math.round(ancho)}" height="${Math.round(alto)}" fill="url(#g)"/></svg>`
  );
}

/**
 * El MISMO fondo para la vista previa y las miniaturas del panel.
 *
 * Devuelve un valor de `background` de CSS: con el fondo clásico, el
 * color plano de siempre; con degradado, las mismas paradas que recibe
 * sharp. Ver el aviso de la cabecera sobre por qué esto puede convivir
 * con `svgDelFondo` sin ser «dos algoritmos».
 */
export function cssDelFondo(fondo: FondoTira, colorTarjeta: string): string {
  const paradas = paradasDelFondo(fondo, colorTarjeta);
  if (!paradas) return hexSeguro(colorTarjeta, FONDO_POR_DEFECTO);
  const stops = paradas.map((p) => `${p.color} ${(p.pos * 100).toFixed(1)}%`).join(", ");
  return `linear-gradient(to bottom, ${stops})`;
}

/**
 * LO QUE VIENE DE LA BASE NO SE USA TAL CUAL.
 *
 * Mismo criterio que `configDesdeJson`: cada campo que no se reconozca
 * degrada ESE campo, nunca la tarjeta. Lo que salga de acá va directo a
 * componer el PNG que se firma y se manda al teléfono.
 */
export function fondoDesdeJson(valor: unknown): FondoTira {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return FONDO_CLASICO;
  const f = valor as Record<string, unknown>;
  if (f.forma !== "resplandor" && f.forma !== "cascada") return FONDO_CLASICO;

  // Sin un acento válido no hay degradado posible: se cae al clásico en
  // vez de dibujar una franja de un solo color que parecería un error.
  const acento = typeof f.acento === "string" ? f.acento : "";
  if (!/^#[0-9A-Fa-f]{6}$/.test(acento)) return FONDO_CLASICO;

  const acento2 =
    typeof f.acento2 === "string" && /^#[0-9A-Fa-f]{6}$/.test(f.acento2) ? f.acento2 : null;

  return { forma: f.forma, acento, acento2 };
}

/** ¿Es el fondo de siempre? Para no escribir lo que no hace falta. */
export function esFondoClasico(fondo: FondoTira): boolean {
  return fondo.forma === "plano";
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS PALETAS LISTAS
 * ════════════════════════════════════════════════════════════════════
 *
 * Cada una fija el color de la tarjeta, la forma y sus acentos: elegir
 * una repinta la tarjeta ENTERA, no solo la franja. Es lo que hace que
 * se sienta como customización de verdad y no como mover un control.
 *
 * ⚠️ TODAS SON OSCURAS, Y NO ES UNA PREFERENCIA ESTÉTICA. El texto del
 * pase está clavado en blanco (`foregroundColor` en `tarjeta.ts`), así
 * que un fondo claro es una tarjeta ilegible. Las ocho pasan el umbral
 * de 4,5:1 contra el blanco — lo comprueba `fondo-tira.test.ts`.
 *
 * El día que se libere el color del texto, ahí se pueden abrir las
 * paletas claras. Antes no.
 */
export type PaletaPase = {
  id: string;
  nombre: string;
  /** `pase_color_fondo`: el color de la tarjeta. */
  fondo: string;
  /** `pase_color_sello`: el color de los sellos. */
  sello: string;
  /** El degradado de la franja. */
  degradado: FondoTira;
};

export const PALETAS_PASE: readonly PaletaPase[] = [
  {
    id: "bookea",
    nombre: "Bookea",
    fondo: "#002472",
    sello: "#F39200",
    degradado: { forma: "resplandor", acento: "#1B3A8F", acento2: null },
  },
  {
    id: "medianoche",
    nombre: "Medianoche",
    fondo: "#0B1026",
    sello: "#7C8CE8",
    degradado: { forma: "cascada", acento: "#2A3A7A", acento2: "#4C5FC9" },
  },
  {
    id: "atardecer",
    nombre: "Atardecer",
    fondo: "#3A1220",
    sello: "#F0A45C",
    degradado: { forma: "cascada", acento: "#8C2F1E", acento2: "#C4571F" },
  },
  {
    id: "selva",
    nombre: "Selva",
    fondo: "#0E2A20",
    sello: "#8FD48A",
    degradado: { forma: "resplandor", acento: "#1E5B3F", acento2: "#4C8A46" },
  },
  {
    id: "cafe",
    nombre: "Café",
    fondo: "#2A1A10",
    sello: "#D9A566",
    degradado: { forma: "cascada", acento: "#6B3A18", acento2: "#A8742E" },
  },
  {
    id: "oceano",
    nombre: "Océano",
    fondo: "#052833",
    sello: "#5AD1E0",
    degradado: { forma: "resplandor", acento: "#0B5768", acento2: "#14899B" },
  },
  {
    id: "vino",
    nombre: "Vino",
    fondo: "#2B0F1C",
    sello: "#E08CA3",
    degradado: { forma: "cascada", acento: "#6B1F3A", acento2: "#A8455F" },
  },
  {
    id: "grafito",
    nombre: "Grafito",
    fondo: "#15171C",
    sello: "#A8AEB8",
    degradado: { forma: "resplandor", acento: "#33373F", acento2: "#5A6069" },
  },
] as const;
