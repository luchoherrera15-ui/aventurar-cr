"use client";

import {
  CONFIG_CLASICA,
  esClasica,
  layoutDeLaTira,
  type ConfigTira,
} from "@/lib/wallet/layout-tira";

/**
 * ════════════════════════════════════════════════════════════════════
 *  DÓNDE VAN LOS SELLOS — los tres controles de la tira
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (ago 2026): «que nos dé la opción de colocar los
 * sellos abajo, en el medio, etc. — o sea que sea full customizable».
 *
 * ── CADA BOTÓN SE DIBUJA A SÍ MISMO ─────────────────────────────────
 * La miniatura de cada opción NO es un ícono dibujado a mano: sale de
 * `layoutDeLaTira`, la MISMA función que compone el PNG del pase y la
 * vista previa grande. O sea que el botón «Abajo» muestra literalmente
 * lo que va a pasar, con la meta REAL de esta tarjeta.
 *
 * Es lo que hace que esto se entienda sin leer nada, y de paso vuelve
 * imposible el bug clásico de este tipo de control: un ícono que
 * ilustra una opción que el motor dejó de hacer así.
 *
 * Y no cuesta nada — `layoutDeLaTira` es aritmética pura, sin sharp,
 * sin medir el DOM y sin efectos. Nueve miniaturas son nueve bucles de
 * como mucho diez vueltas.
 *
 * ── TRES CONTROLES, NO CINCO ────────────────────────────────────────
 * `ConfigTira` tiene cinco campos y acá se ofrecen TRES. Los dos que
 * faltan no son un olvido:
 *
 *   · `alineacionH` mueve cada sello dentro de SU celda, y como las
 *     celdas siempre reparten el ancho completo, el efecto es que la
 *     fila entera se corre unos píxeles. Un control cuyo resultado
 *     cuesta ver es un control que se toca por curiosidad y después no
 *     se sabe cómo volver atrás.
 *   · `margenY` hace lo mismo que «Posición» pero peor: en vez de tres
 *     opciones legibles, un número que hay que adivinar.
 *
 * Los dos siguen viviendo en el tipo y validados: una tarjeta que los
 * tenga guardados —de una versión futura del panel, o escritos a mano—
 * se dibuja con ellos. Lo que no hay es dónde tocarlos acá.
 */

/** Los tres tamaños que se ofrecen. El medio es el de siempre. */
const ESCALAS = [
  { valor: 0.8, nombre: "Chicos" },
  { valor: 1, nombre: "Normal" },
  { valor: 1.25, nombre: "Grandes" },
] as const;

const POSICIONES = [
  { valor: "arriba", nombre: "Arriba" },
  { valor: "centro", nombre: "Centro" },
  { valor: "abajo", nombre: "Abajo" },
] as const;

const FILAS = [
  { valor: "auto", nombre: "Automático" },
  { valor: 1, nombre: "Una fila" },
  { valor: 2, nombre: "Dos filas" },
] as const;

/**
 * Cuántos sellos dibuja la miniatura.
 *
 * Se usa la meta REAL —para que el botón muestre esta tarjeta y no una
 * genérica— con un piso de tres: con una meta de 1 las tres opciones de
 * «Filas» se ven idénticas y el control parecería roto.
 */
function sellosDeLaMiniatura(meta: number): number {
  return Math.max(3, Math.min(meta, 30));
}

/**
 * La tira, chiquita.
 *
 * Se resuelve en el espacio de Apple (375×123) y se pasa a porcentaje,
 * igual que la vista previa grande: así la miniatura es el mismo dibujo
 * a otra escala y no una segunda aproximación que se puede despegar.
 */
function Miniatura({ config, meta }: { config: ConfigTira; meta: number }) {
  const layout = layoutDeLaTira(sellosDeLaMiniatura(meta), config);
  const lado = (layout.diametro / layout.ancho) * 100;

  return (
    <span
      aria-hidden
      className="relative block w-full overflow-hidden rounded-[4px] bg-current/[0.13]"
      style={{ aspectRatio: "375 / 123" }}
    >
      {layout.posiciones.map((pos, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-current"
          style={{
            left: `${(pos.x / layout.ancho) * 100}%`,
            top: `${(pos.y / layout.alto) * 100}%`,
            width: `${lado}%`,
            aspectRatio: "1 / 1",
          }}
        />
      ))}
    </span>
  );
}

function Fila<T>({
  titulo,
  opciones,
  activo,
  alElegir,
  config,
  meta,
  aplicar,
}: {
  titulo: string;
  opciones: readonly { valor: T; nombre: string }[];
  activo: T;
  alElegir: (valor: T) => void;
  config: ConfigTira;
  meta: number;
  /** Cómo se ve la tira SI se elige esta opción. */
  aplicar: (base: ConfigTira, valor: T) => ConfigTira;
}) {
  return (
    <div>
      <span className="mb-2 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
        {titulo}
      </span>
      <div className="grid grid-cols-3 gap-2">
        {opciones.map((o) => {
          const elegida = o.valor === activo;
          return (
            <button
              key={String(o.valor)}
              type="button"
              aria-pressed={elegida}
              onClick={() => alElegir(o.valor)}
              className={`presionable rounded-xl border p-2 text-center transition-colors ${
                elegida
                  ? "border-bookea-azul bg-bookea-azul-suave text-bookea-azul"
                  : "border-bookea-linea bg-white text-bookea-gris hover:border-bookea-azul/40"
              }`}
            >
              <Miniatura config={aplicar(config, o.valor)} meta={meta} />
              <span
                className={`mt-1.5 block text-[10.5px] font-bold ${
                  elegida ? "text-bookea-azul" : "text-bookea-tinta"
                }`}
              >
                {o.nombre}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ControlesTira({
  valor,
  alCambiar,
  meta,
}: {
  valor: ConfigTira;
  alCambiar: (config: ConfigTira) => void;
  /** Cuántos sellos promete la tarjeta hoy: la miniatura dibuja ESOS. */
  meta: number;
}) {
  return (
    <div className="space-y-4">
      <Fila
        titulo="Posición"
        opciones={POSICIONES}
        activo={valor.alineacionV}
        alElegir={(v) => alCambiar({ ...valor, alineacionV: v })}
        config={valor}
        meta={meta}
        aplicar={(base, v) => ({ ...base, alineacionV: v })}
      />
      <Fila
        titulo="Tamaño"
        opciones={ESCALAS}
        activo={escalaMasCercana(valor.escalaSello)}
        alElegir={(v) => alCambiar({ ...valor, escalaSello: v })}
        config={valor}
        meta={meta}
        aplicar={(base, v) => ({ ...base, escalaSello: v })}
      />
      <Fila
        titulo="Filas"
        opciones={FILAS}
        activo={valor.filas}
        alElegir={(v) => alCambiar({ ...valor, filas: v })}
        config={valor}
        meta={meta}
        aplicar={(base, v) => ({ ...base, filas: v })}
      />

      {!esClasica(valor) && (
        <button
          type="button"
          onClick={() => alCambiar(CONFIG_CLASICA)}
          className="presionable text-[11.5px] font-bold text-bookea-gris underline hover:text-bookea-tinta"
        >
          Volver al diseño de siempre
        </button>
      )}
    </div>
  );
}

/**
 * Qué botón de «Tamaño» se ve elegido.
 *
 * La columna guarda un número y los botones son tres. Un `===` dejaría
 * los TRES apagados si la tarjeta trae un valor de otra versión del
 * panel —o escrito a mano en el SQL Editor— y el control se leería como
 * roto. Se marca el más parecido, que además es el que el dueño va a
 * querer tocar.
 */
type Escala = (typeof ESCALAS)[number]["valor"];

function escalaMasCercana(valor: number): Escala {
  let mejor: Escala = ESCALAS[1].valor;
  let distancia = Infinity;
  for (const e of ESCALAS) {
    const d = Math.abs(e.valor - valor);
    if (d < distancia) {
      distancia = d;
      mejor = e.valor;
    }
  }
  return mejor;
}
