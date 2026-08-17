import type { CSSProperties, ReactNode } from "react";
import {
  CIFRA,
  CUERPO_SUAVE,
  DETALLE,
  DISCO_ACENTO,
  ESTADO_MARCA,
  ESTADO_PILDORA,
  EYEBROW,
  GAP_TABLERO,
  PADDING_CARD,
  RADIO_CARD,
  RADIO_METRICA,
  RADIO_PILDORA,
  ROTULO_CIFRA,
  SUPERFICIE_PANEL,
  TITULO_CARD,
  type EstadoPanel,
} from "./sistema";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  LAS PIEZAS COMPARTIDAS DEL PANEL
 * ═══════════════════════════════════════════════════════════════════
 *
 * La anatomía de `referencia/bookeapaneles.html` convertida en
 * componentes, para que rediseñar una pantalla sea COMPONER y no
 * escribir CSS nuevo. Todo el color, el radio, la elevación y la
 * escala salen de `./sistema.ts`, que es donde está el contraste
 * medido: acá adentro no hay ni un hexadecimal ni un tamaño suelto.
 *
 * ── COMPONENTES DE SERVIDOR A PROPÓSITO ────────────────────────────
 * Ni `"use client"` ni hooks: los monta `page.tsx` en el servidor, y
 * los paneles interactivos los pueden importar igual. Al revés no
 * funciona — un helper exportado desde un módulo cliente da un 500
 * invisible al build, y eso ya rompió Finanzas y el panel de IA.
 * Todo lo que necesite estado (abrir, cerrar, enviar) se pasa como
 * `children` desde el componente cliente que lo tenga.
 */

// ───────────────────────────────────────────────────────────────────
//  LA TARJETA Y SU ENCABEZADO
// ───────────────────────────────────────────────────────────────────

/**
 * EL ENCABEZADO DE UNA TARJETA (`.card-head` de la maqueta).
 *
 * Kicker + título a la izquierda, y SIEMPRE algo a la derecha: un
 * enlace («Ver agenda completa →»), un contador o un botón. En la
 * maqueta no hay un solo `h2` que quede solo, y es lo que hace que una
 * tarjeta se lea como un módulo del panel y no como un párrafo con
 * título.
 *
 * `nivel` existe porque una pantalla puede tener el `h1` afuera (el
 * titular de la pantalla) y entonces las tarjetas son `h2`, o estar
 * dentro de una sección que ya tiene `h2`. El orden de encabezados es
 * lo que un lector de pantalla usa para saltar de bloque en bloque, y
 * si se saltea un nivel se rompe esa navegación.
 */
export function CardHead({
  eyebrow,
  titulo,
  accion,
  nivel = "h2",
  id,
}: {
  eyebrow?: string;
  titulo: ReactNode;
  /** Lo que va pegado al borde derecho: enlace, contador o botón. */
  accion?: ReactNode;
  nivel?: "h2" | "h3";
  id?: string;
}) {
  const Titulo = nivel;
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <div className="min-w-0">
        {eyebrow && <p className={`mb-1.5 ${EYEBROW}`}>{eyebrow}</p>}
        <Titulo id={id} className={TITULO_CARD}>
          {titulo}
        </Titulo>
      </div>
      {accion}
    </div>
  );
}

/**
 * LA TARJETA (`.card`).
 *
 * Blanca, con borde de 1px y la elevación del sistema, sobre el lienzo
 * gris del panel. Ese contraste de 1,08:1 entre tarjeta y lienzo es
 * chico a propósito —la maqueta usa 1,07:1— y es EL cambio que hace
 * que el panel se lea como un panel: antes el lienzo era blanco y las
 * tarjetas desaparecían.
 *
 * Con `titulo` se pinta el `CardHead` sola; sin él, es una superficie
 * pelada para lo que ya trae su propio encabezado.
 */
export function Card({
  eyebrow,
  titulo,
  accion,
  nivel,
  children,
  className = "",
  /** Sin padding: para una tabla o una lista que llega al borde. */
  sinPadding = false,
}: {
  eyebrow?: string;
  titulo?: ReactNode;
  accion?: ReactNode;
  nivel?: "h2" | "h3";
  children: ReactNode;
  className?: string;
  sinPadding?: boolean;
}) {
  return (
    <section
      className={`${SUPERFICIE_PANEL} ${RADIO_CARD} ${sinPadding ? "" : PADDING_CARD} ${className}`}
    >
      {titulo && <CardHead eyebrow={eyebrow} titulo={titulo} accion={accion} nivel={nivel} />}
      {children}
    </section>
  );
}

/**
 * LA GRILLA DEL TABLERO: la columna ancha (lo que se lee) y la angosta
 * (lo que se decide), como el `.main-grid` de la maqueta. Debajo de lg
 * es una sola columna — a 390px dos columnas no son dos columnas, son
 * dos columnas ilegibles.
 */
export function GrillaTablero({ children }: { children: ReactNode }) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1.72fr)_minmax(280px,0.78fr)] ${GAP_TABLERO}`}>
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  LA MÉTRICA
// ───────────────────────────────────────────────────────────────────

/**
 * UN NÚMERO DEL PANEL (`.metric`).
 *
 * Disco de ícono arriba (en el acento del tipo de negocio, ≥5,56:1),
 * rótulo en versalitas, la cifra grande y el detalle debajo. La
 * jerarquía la hace el TAMAÑO y el PESO, no el color: la cifra va
 * siempre en la tinta más fuerte que hay (18,10:1) y el rótulo la
 * acompaña en gris (7,12:1). Ningún número tiene color propio — un
 * monto ya dice que es plata con el «₡», y cuando los montos iban en
 * naranja la mitad de la fila gritaba a 2,94:1.
 *
 * NO LLEVA EL CÍRCULO DECORATIVO de `.metric:after`. Ya lo sacamos una
 * vez: pasaba justo por detrás de la cifra, o sea un adorno tapando el
 * único dato de la tarjeta. El porqué largo está en `tarjeta-dato.ts`.
 *
 * `tendencia` es OPCIONAL y no se rellena nunca: la maqueta le pone
 * «+12% ↗» a las cuatro métricas, pero acá solo aparece donde
 * `metricas.ts` calcula de verdad un comparativo contra el período
 * anterior. Una tarjeta sin tendencia es preferible a una que miente.
 */
export function Metrica({
  rotulo,
  valor,
  detalle,
  icono,
  tendencia,
}: {
  rotulo: string;
  valor: string;
  detalle?: string;
  icono?: ReactNode;
  tendencia?: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col ${SUPERFICIE_PANEL} ${RADIO_METRICA} p-3 sm:p-3.5`}
    >
      <div className="flex items-center justify-between gap-2">
        {icono && (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[15px] sm:h-9 sm:w-9 sm:text-[17px]"
            style={DISCO_ACENTO as CSSProperties}
          >
            {icono}
          </span>
        )}
        {tendencia}
      </div>
      <p className={`mt-3 truncate ${ROTULO_CIFRA}`}>{rotulo}</p>
      <p className={`mt-1.5 truncate ${CIFRA}`}>{valor}</p>
      {detalle && <p className={`mt-1.5 truncate ${DETALLE}`}>{detalle}</p>}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  LA PÍLDORA DE ESTADO
// ───────────────────────────────────────────────────────────────────

/**
 * LA PÍLDORA DE ESTADO (`.status`). Fondo tenue + letra oscura, en los
 * cinco estados del sistema; los cinco pares están medidos en
 * `sistema.ts` y los cinco pasan AA.
 *
 * `colapsa`: por debajo de sm la maqueta convierte la píldora en un
 * punto de 8px, porque en una fila de 390px el texto de estado se come
 * el nombre del cliente. El texto NO desaparece del árbol de
 * accesibilidad —queda en `sr-only`—, así que quien usa un lector de
 * pantalla sigue oyendo «Confirmada» donde quien mira ve un punto. Si
 * se ocultara con `hidden`, el estado directamente dejaría de existir
 * para esa persona.
 */
export function PildoraEstado({
  estado,
  children,
  colapsa = false,
}: {
  estado: EstadoPanel;
  children: ReactNode;
  colapsa?: boolean;
}) {
  if (colapsa) {
    // Las clases del punto van ESCRITAS, no compuestas con `sm:${…}`:
    // Tailwind busca los nombres de clase como texto en el código, y
    // una variante pegada a una interpolación (`sm:` + constante) no
    // existe en el archivo, así que esa utilidad nunca se genera.
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center max-sm:h-2.5 max-sm:w-2.5 max-sm:rounded-full max-sm:p-0 sm:rounded-lg sm:px-2 sm:py-1 sm:text-[11px] sm:font-extrabold sm:uppercase sm:leading-none sm:tracking-wide ${ESTADO_PILDORA[estado]}`}
      >
        <span className="max-sm:sr-only">{children}</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center ${RADIO_PILDORA} px-2 py-1 text-[11px] font-extrabold uppercase leading-none tracking-wide ${ESTADO_PILDORA[estado]}`}
    >
      {children}
    </span>
  );
}

/** El punto de la leyenda: el MISMO color que la barrita de la fila
 *  del mismo estado, para que la leyenda se vea igual a lo que explica.
 *  Los cinco pasan 3:1 contra la tarjeta blanca. */
export function PuntoEstado({ estado }: { estado: EstadoPanel }) {
  return (
    <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${ESTADO_MARCA[estado]}`} />
  );
}

// ───────────────────────────────────────────────────────────────────
//  LA FILA DE LISTADO
// ───────────────────────────────────────────────────────────────────

/**
 * LA FILA CANÓNICA DE TODO LISTADO DEL PANEL (`.appointment`).
 *
 * Grilla de cinco celdas, igual que la maqueta:
 *   [ contexto 54px | barrita 4px | quién/qué 1fr | estado auto | · ]
 *
 * La barrita de 4px es la que comunica el estado sin pintar la fila
 * entera de color — que es exactamente el problema que tenía el
 * calendario, con los días vendidos en rojo. Es un elemento gráfico,
 * así que su color está medido a ≥3:1 contra la tarjeta blanca.
 *
 * `separador`: la última fila de una lista no lo lleva; quien la pinta
 * decide, porque solo ella sabe cuál es la última.
 *
 * No es un `<button>` ni un `<Link>`: la fila es la PIEL. Quien la use
 * la envuelve en lo que corresponda —o no la envuelve en nada, que es
 * lo que hace el histórico— sin que esta pieza le imponga un
 * comportamiento nuevo a una pantalla que hoy no lo tiene.
 */
export function FilaPanel({
  contexto,
  marca,
  titulo,
  detalle,
  derecha,
  separador = true,
  className = "",
}: {
  /** La columna angosta de la izquierda: la hora, el día, la fecha. */
  contexto?: ReactNode;
  /** El estado, como barrita de color. `null` = fila sin estado. */
  marca?: EstadoPanel | null;
  titulo: ReactNode;
  detalle?: ReactNode;
  /** Píldora, monto o acción, pegado al borde derecho. */
  derecha?: ReactNode;
  separador?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-[60px] items-center gap-2.5 py-2 ${
        separador ? "border-b border-aventurea-line" : ""
      } ${className}`}
    >
      {contexto && <div className="w-[62px] shrink-0 sm:w-[74px]">{contexto}</div>}
      {marca !== undefined && marca !== null && (
        <span aria-hidden="true" className={`h-9 w-1 shrink-0 rounded-full ${ESTADO_MARCA[marca]}`} />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="truncate text-[13.5px] font-bold leading-tight text-aventurea-ink">
          {titulo}
        </div>
        {detalle && <div className={`truncate ${CUERPO_SUAVE}`}>{detalle}</div>}
      </div>
      {derecha}
    </div>
  );
}

/** La columna angosta de la izquierda de una fila: el dato fuerte
 *  arriba (la hora, el día) y su unidad debajo. */
export function ContextoFila({ fuerte, suave }: { fuerte: ReactNode; suave?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="truncate text-[12.5px] font-extrabold leading-tight text-aventurea-ink">
        {fuerte}
      </span>
      {suave && (
        <span className="truncate text-[10.5px] uppercase leading-tight tracking-wide text-aventurea-ink-soft">
          {suave}
        </span>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  EL ESTADO VACÍO
// ───────────────────────────────────────────────────────────────────

/**
 * QUÉ SE VE CUANDO NO HAY NADA.
 *
 * Un bloque hundido con una frase que dice qué va a aparecer acá, no
 * una tarjeta con un cero. Es la contracara de la regla de no inventar
 * datos: si no hay dato, se dice que no hay dato.
 */
export function CardVacia({
  children,
  accion,
}: {
  children: ReactNode;
  /** Lo que se puede hacer para que deje de estar vacío, si aplica. */
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-aventurea-line bg-aventurea-cream-2 p-4">
      <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">{children}</p>
      {accion}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  EL ESQUELETO DE CARGA
// ───────────────────────────────────────────────────────────────────
//
// Un esqueleto solo sirve si CALCA la forma de lo que viene: si mide
// distinto, la página salta al llegar el contenido y la espera se
// siente peor que con un spinner. Por eso estas piezas usan las MISMAS
// constantes (`SUPERFICIE_PANEL`, `RADIO_*`, `PADDING_CARD`) que las
// reales — cuando alguien cambie el padding de una tarjeta, el hueco
// lo sigue solo.

/** El hueco gris del panel. Es el mismo de `app/esqueleto.tsx`,
 *  repetido acá para que las piezas del panel no dependan de un módulo
 *  de rutas. */
export function HuecoPanel({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`animate-pulse rounded-lg bg-aventurea-navy/[0.07] ${className}`} />
  );
}

/** El hueco de una métrica, del alto y el radio de la real. */
export function EsqueletoMetrica() {
  return (
    <div className={`${SUPERFICIE_PANEL} ${RADIO_METRICA} p-3 sm:p-3.5`}>
      <HuecoPanel className="h-8 w-8 rounded-xl sm:h-9 sm:w-9" />
      <HuecoPanel className="mt-3 h-2.5 w-16" />
      <HuecoPanel className="mt-2 h-4 w-24" />
      <HuecoPanel className="mt-2 h-2.5 w-20" />
    </div>
  );
}

/** El hueco de una tarjeta: su encabezado y `filas` renglones. */
export function EsqueletoCardPanel({ filas = 3 }: { filas?: number }) {
  return (
    <div className={`${SUPERFICIE_PANEL} ${RADIO_CARD} ${PADDING_CARD}`}>
      <HuecoPanel className="h-2.5 w-24" />
      <HuecoPanel className="mt-2 h-4 w-40" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: filas }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <HuecoPanel className="h-9 w-1 rounded-full" />
            <div className="min-w-0 flex-1">
              <HuecoPanel className="h-3.5 w-1/2" />
              <HuecoPanel className="mt-2 h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
