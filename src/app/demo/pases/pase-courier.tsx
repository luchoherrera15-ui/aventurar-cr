/**
 * PASE DEMO — EMPRESA COURIER · «Ruta Express CR» (negocio FICTICIO).
 *
 * Utilería de venta: sirve para mostrarle a un prospecto cómo se ve su
 * programa de lealtad dentro de Wallet. No es un negocio real, no lee
 * datos de la base y no reemplaza a `VistaPase` (esa es la vista previa
 * de verdad, la que arma el mismo `pass.json` que se firma).
 *
 * Respeta la ANATOMÍA de un pase de Apple para que se lea como tal:
 *   logo + nombre  ·  encabezado a la derecha (label chico + valor)
 *   la BANDA (strip 375×123) con la grilla de sellos adentro
 *   detalle  ·  regalía
 *   el código sobre BLANCO + «Powered by Bookea.lat»
 *
 * Lo que cambia acá es el vestido: degradado navy→grafito con diagonales
 * de velocidad, un patrón de rutas y nodos, y sellos postales dentados
 * que se «estampan» en ámbar cuando se ganan.
 */

const NEGOCIO = "Ruta Express CR";

export const COPY = {
  negocio: NEGOCIO,
  rubro: "Mensajería y paquetería",
  regalia: "1 envío nacional gratis",
  mecanica: "Un sello por cada envío pagado. Al décimo, el envío corre por cuenta de la casa.",
  titulo: "El que despacha todas las semanas no debería andar comparando precios",
  parrafo:
    "En courier el cliente que vale es el que manda seguido: la tienda de Instagram, la farmacia del barrio, el que vende repuestos. Ese cliente se pasa al primero que le tire ₡500 menos, porque no tiene ninguna razón para quedarse. La tarjeta le da esa razón y se la deja en el teléfono, al lado de la del banco.",
  bullets: [
    "El cliente ve cuántos envíos le faltan para el gratis cada vez que abre Wallet — nadie tiene que recordárselo.",
    "El sello se pone en el mostrador o en la entrega, desde el teléfono del mensajero: se acaban las tarjetitas de cartón que se mojan en la moto.",
    "La regalía es un envío suyo, no efectivo: premia al cliente y de paso le mete otro paquete a una ruta que ya iba a hacer.",
  ],
} as const satisfies {
  negocio: string;
  rubro: string;
  regalia: string;
  mecanica: string;
  titulo: string;
  parrafo: string;
  bullets: readonly string[];
};

// ── Paleta ─────────────────────────────────────────────────────────
// Navy profundo → grafito, con dos acentos: cian eléctrico para las
// rutas (velocidad) y ámbar para el sello estampado (papel, aduana).
const NAVY = "#050b1a";
const GRAFITO = "#16202f";
const CIAN = "#22d3ee";
const AMBAR = "#f7a827";

export default function PaseCourier({ sellos = 4, meta = 10 }: { sellos?: number; meta?: number }) {
  const total = Math.max(1, Math.min(20, Math.trunc(meta)));
  const ganados = Math.max(0, Math.min(total, Math.trunc(sellos)));
  const faltan = total - ganados;

  return (
    <div
      className="mx-auto w-full max-w-[300px] overflow-hidden rounded-3xl"
      style={{
        // El degradado: la luz entra arriba a la izquierda (navy casi
        // negro) y se abre en diagonal hacia el grafito, con un soplo
        // ámbar abajo a la derecha. Esa diagonal es la que le da a la
        // tarjeta la sensación de que va en movimiento.
        background:
          "radial-gradient(120% 90% at 12% 0%, rgba(34,211,238,.20) 0%, rgba(34,211,238,0) 55%)," +
          "radial-gradient(90% 70% at 100% 100%, rgba(247,168,39,.16) 0%, rgba(247,168,39,0) 60%)," +
          `linear-gradient(148deg, ${NAVY} 0%, #0b1526 42%, ${GRAFITO} 78%, #0a1220 100%)`,
        boxShadow: "0 26px 55px -18px rgba(4,10,24,.75), inset 0 1px 0 rgba(255,255,255,.10)",
      }}
    >
      <div className="relative px-4 pt-4">
        <TexturaRutas />

        {/* Encabezado: logo + nombre a la izquierda, contador a la
            derecha. Es el renglón que Apple dibuja siempre arriba. */}
        <div className="relative flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <LogoRuta />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold leading-tight text-white">
                {NEGOCIO}
              </span>
              <span
                className="block text-[7.5px] font-bold uppercase tracking-[0.18em]"
                style={{ color: CIAN }}
              >
                Encomiendas · Todo el país
              </span>
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[8.5px] uppercase tracking-wider text-white/65">Envíos</span>
            <span className="block text-[15px] font-extrabold leading-tight tabular-nums text-white">
              {ganados}/{total}
            </span>
          </span>
        </div>

        <Banda ganados={ganados} total={total} />

        <div className="relative mt-3">
          <span className="block text-[8.5px] uppercase tracking-wider text-white/65">
            Cómo funciona
          </span>
          <span className="block text-[11.5px] leading-snug text-white/90">{COPY.mecanica}</span>
        </div>

        <div className="relative mt-2.5 flex items-end justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[8.5px] uppercase tracking-wider text-white/65">
              Tu regalía
            </span>
            <span className="block truncate text-[12px] font-bold" style={{ color: AMBAR }}>
              {COPY.regalia}
            </span>
          </span>
          <span
            className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-bold leading-none"
            style={{
              color: faltan === 0 ? NAVY : "#ffffff",
              background: faltan === 0 ? AMBAR : "rgba(255,255,255,.12)",
              boxShadow:
                faltan === 0 ? `0 0 16px ${AMBAR}66` : "inset 0 0 0 1px rgba(255,255,255,.18)",
            }}
          >
            {faltan === 0 ? "¡Listo para canjear!" : `Te faltan ${faltan}`}
          </span>
        </div>
      </div>

      {/* El código va sobre BLANCO siempre: sobre el navy no escanea. */}
      <div className="mt-4 bg-white px-4 py-3.5">
        <CodigoBarras />
        <p className="mt-1.5 text-center text-[8.5px] text-[#53657f]">Powered by Bookea.lat</p>
      </div>
    </div>
  );
}

/**
 * LA BANDA (strip). Proporción 375×123, la de Apple: dibujada más alta
 * de lo que es, le hace creer al negocio que le caben más sellos de los
 * que le caben en el teléfono.
 */
function Banda({ ganados, total }: { ganados: number; total: number }) {
  const columnas = total > 10 ? 10 : total > 6 ? 5 : total;

  return (
    <div
      className="relative mt-3 overflow-hidden rounded-lg"
      style={{
        aspectRatio: "375 / 123",
        background: "linear-gradient(115deg, #0a1424 0%, #101d31 55%, #0b1422 100%)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)",
      }}
    >
      <TexturaDiagonales />
      <div
        className="absolute inset-0 grid content-center items-center justify-center gap-1.5 px-3"
        style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, i) => (
          <SelloPaquete key={i} encendido={i < ganados} numero={i + 1} />
        ))}
      </div>
    </div>
  );
}

/**
 * EL SELLO: una caja de encomienda dentro de un sello postal dentado.
 *
 * ENCENDIDO — ámbar macizo, la caja en negativo, cinta cian cruzada y
 *             halo alrededor: se lee como tinta recién estampada.
 * APAGADO   — el mismo dibujo en contorno tenue, con el número del
 *             envío abajo: el hueco que todavía falta llenar.
 */
function SelloPaquete({ encendido, numero }: { encendido: boolean; numero: number }) {
  return (
    <span
      aria-hidden
      className="relative mx-auto grid h-[26px] w-[26px] place-items-center"
      style={{
        background: encendido ? AMBAR : "rgba(255,255,255,.05)",
        // El dentado del sello postal, recortado con clip-path.
        clipPath:
          "polygon(0% 8%, 8% 0%, 25% 6%, 42% 0%, 58% 6%, 75% 0%, 92% 6%, 100% 14%, 94% 30%, 100% 46%, 94% 62%, 100% 78%, 92% 94%, 75% 100%, 58% 94%, 42% 100%, 25% 94%, 8% 100%, 0% 86%, 6% 70%, 0% 54%, 6% 38%, 0% 22%)",
        boxShadow: encendido ? `0 0 12px ${AMBAR}88` : "none",
        transition: "background .25s ease, box-shadow .25s ease",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2.6 21 7v10l-9 4.4L3 17V7l9-4.4Z"
          fill={encendido ? "rgba(8,14,28,.92)" : "none"}
          stroke={encendido ? "rgba(8,14,28,.92)" : "rgba(255,255,255,.36)"}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M3 7l9 4.3L21 7M12 11.3v10.1"
          stroke={encendido ? AMBAR : "rgba(255,255,255,.28)"}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {encendido ? (
          <path d="M7.5 4.7 16.5 9.1" stroke={CIAN} strokeWidth="1.8" strokeLinecap="round" />
        ) : null}
      </svg>
      {!encendido ? (
        <span className="absolute inset-x-0 bottom-[1px] text-center text-[6px] font-bold leading-none text-white/45">
          {numero}
        </span>
      ) : null}
    </span>
  );
}

/** Rutas: trazos punteados con nodos, como el track de un envío. */
function TexturaRutas() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 300 260"
      preserveAspectRatio="none"
      fill="none"
    >
      <path
        d="M-20 46C60 6 130 96 210 44 258 13 292 34 320 18"
        stroke={CIAN}
        strokeOpacity=".18"
        strokeWidth="1.2"
        strokeDasharray="5 6"
      />
      <path
        d="M-20 208C54 246 122 172 196 214 250 244 296 210 320 224"
        stroke="#ffffff"
        strokeOpacity=".08"
        strokeWidth="1.2"
        strokeDasharray="3 7"
      />
      <circle cx="210" cy="44" r="2.4" fill={CIAN} fillOpacity=".45" />
      <circle cx="196" cy="214" r="2" fill={AMBAR} fillOpacity=".38" />
    </svg>
  );
}

/** Diagonales de velocidad dentro de la banda, más marcadas a la derecha. */
function TexturaDiagonales() {
  return (
    <>
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,.07) 0 1px, rgba(255,255,255,0) 1px 13px)",
        }}
      />
      <span
        aria-hidden
        className="absolute inset-y-0 right-0 w-1/2"
        style={{
          backgroundImage: `repeating-linear-gradient(115deg, ${CIAN}22 0 2px, rgba(0,0,0,0) 2px 26px)`,
          maskImage: "linear-gradient(90deg, transparent, #000)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000)",
        }}
      />
    </>
  );
}

/** El logo: una flecha de ruta dentro de un chip cian. */
function LogoRuta() {
  return (
    <span
      aria-hidden
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
      style={{
        background: `linear-gradient(140deg, ${CIAN}, #0e7490)`,
        boxShadow: `0 4px 12px ${CIAN}44`,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 15h9M6 19h5"
          stroke={NAVY}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeOpacity=".55"
        />
        <path
          d="M4 10.5h11l3.4-4.2L21 12l-2.6 5.7L15 13.5H4"
          stroke={NAVY}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/**
 * El código del pase, dibujado. Es utilería: no codifica nada.
 *
 * Los anchos son una lista fija y no `Math.random()`: un patrón al azar
 * en render pinta una cosa en el servidor y otra en el cliente, y React
 * tira hydration mismatch.
 */
function CodigoBarras() {
  const anchos = [3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 2, 1, 3, 1, 2, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1];
  return (
    <span
      aria-hidden
      className="mx-auto flex h-[46px] w-[190px] items-stretch justify-center gap-[2px]"
    >
      {anchos.map((w, i) => (
        <span
          key={i}
          style={{ width: w * 2, background: i % 2 === 0 ? "#0a1226" : "transparent" }}
        />
      ))}
    </span>
  );
}
