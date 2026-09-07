import { ROTULO_CAMPO } from "@/components/panel/sistema";

/**
 * ── LAS PIEZAS DEL ESTUDIO ──────────────────────────────────────────
 * Rediseño del editor (4 sep 2026): «más ordenado, como de diseñador
 * profesional». Lo que se lee como desorden en un editor no es la
 * cantidad de opciones: es que cada una tenga su propio tamaño y su
 * propia forma. Así que hay CUATRO piezas y todo el estudio se arma con
 * ellas: un grupo (rótulo + ayuda + raya), un control con su rótulo
 * chico, el control segmentado para las listas de 2 a 4 opciones, y las
 * fichas (grilla de botones con nombre y pie) para las de 5 o más.
 *
 * Desde el 7 sep 2026 viven en ESTE módulo, aparte: el editor del
 * encabezado (encabezado-editor.tsx) las usa también, y son las mismas
 * piezas a propósito — dos estudios con dos juegos de controles se
 * verían como dos productos.
 *
 * Viven en un módulo y no adentro del componente por lo de siempre:
 * un componente declarado dentro del render es un tipo nuevo en cada
 * pasada y React remonta el subárbol — acá, con la previa repintando
 * en cada tecla, eso es perder el foco de lo que se está escribiendo.
 */
export function Grupo({
  titulo,
  pie,
  primero = false,
  children,
}: {
  titulo: string;
  pie?: string;
  primero?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={primero ? "" : "mt-6 border-t border-aventurea-line pt-5"}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-aventurea-navy">{titulo}</h3>
        {pie && <p className="text-[12px] text-aventurea-ink-soft">{pie}</p>}
      </div>
      {children}
    </section>
  );
}

export function Control({ rotulo, nota, children }: { rotulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={ROTULO_CAMPO}>{rotulo}</p>
      <div className="mt-1.5">{children}</div>
      {nota && <p className="mt-1.5 text-[11.5px] leading-snug text-aventurea-ink-soft">{nota}</p>}
    </div>
  );
}

/**
 * El control segmentado: de 2 a 4 opciones del MISMO ancho, una activa.
 * Es el mismo control para las puertas, los bordes y la portada, y por
 * eso las filas se leen como una sola cosa.
 */
export function Segmentos<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiqueta,
}: {
  opciones: { id: T; nombre: string; pie?: string }[];
  valor: T;
  alCambiar: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="grid gap-1 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-1"
      style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
    >
      {opciones.map((o) => {
        const activo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => alCambiar(o.id)}
            aria-pressed={activo}
            title={o.pie}
            className={`presionable min-h-[40px] truncate rounded-lg px-2 text-[12.5px] font-bold transition-colors ${
              activo ? "bg-white text-aventurea-navy shadow-plano" : "text-aventurea-ink-soft hover:text-aventurea-navy"
            }`}
          >
            {o.nombre}
          </button>
        );
      })}
    </div>
  );
}

/** Las fichas: para listas de cinco o más, con nombre y una línea. */
export function Fichas<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiqueta,
  columnas = "grid-cols-2 sm:grid-cols-5",
  vista,
}: {
  opciones: { id: T; nombre: string; pie?: string }[];
  valor: T;
  alCambiar: (v: T) => void;
  etiqueta: string;
  columnas?: string;
  /** Una miniatura opcional por opción, arriba del nombre. */
  vista?: (id: T) => React.ReactNode;
}) {
  return (
    <div role="group" aria-label={etiqueta} className={`grid gap-2 ${columnas}`}>
      {opciones.map((o) => {
        const activo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => alCambiar(o.id)}
            aria-pressed={activo}
            title={o.pie}
            className={`presionable overflow-hidden rounded-xl border text-left transition-colors ${
              activo ? "border-aventurea-navy bg-aventurea-navy/5 ring-2 ring-aventurea-navy/20" : "border-aventurea-line hover:border-aventurea-navy/40"
            }`}
          >
            {vista && vista(o.id)}
            <span className="block px-2.5 py-2">
              <span className="block truncate text-[12px] font-extrabold text-aventurea-ink">{o.nombre}</span>
              {o.pie && <span className="block truncate text-[10.5px] text-aventurea-ink-soft">{o.pie}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const opcionesDe = <T extends string>(lista: readonly T[], dic: Record<T, { nombre: string; pie: string }>) =>
  lista.map((id) => ({ id, nombre: dic[id].nombre, pie: dic[id].pie || undefined }));
