/**
 * PASE DEMO — SALA DE BELLEZA («Studio Aura Nails», negocio ficticio).
 *
 * Es utilería de venta: sirve para MOSTRAR cómo se ve un pase de Bookea
 * Lealtad en el teléfono de una clienta. No lee datos, no habla con la
 * base y no reemplaza a `VistaPase` (src/components/lealtad/vista-pase.tsx),
 * que sigue siendo la vista previa REAL del producto.
 *
 * Respeta la ANATOMÍA de ese pase a propósito —encabezado con el nombre
 * y el contador, franja de sellos con la proporción de Apple (375×123),
 * detalle, regalía y el código al pie sobre blanco— para que se lea como
 * un pase de Wallet de verdad y no como una tarjeta cualquiera.
 *
 * El sello temático es un FRASQUITO DE ESMALTE dibujado en SVG: apagado
 * (vino desaturado, sin brillo) el que falta; encendido (rosa vivo, halo
 * y reflejo) el que ya se ganó.
 *
 * El teléfono lo pone la página; acá sale SOLO la tarjeta.
 */

const NEGOCIO = "Studio Aura Nails";
const REGALIA = "Manicure en gel de cortesía";

export type CopyDemo = {
  negocio: string;
  rubro: string;
  regalia: string;
  mecanica: string;
  titulo: string;
  parrafo: string;
  bullets: string[];
};

/** El texto comercial de esta industria. Lo pinta la página al lado del mockup. */
export const COPY: CopyDemo = {
  negocio: NEGOCIO,
  rubro: "Sala de belleza y uñas",
  regalia: REGALIA,
  mecanica: "1 sello por servicio · 10 sellos = regalía",
  titulo: "La clienta que vuelve cada tres semanas es todo tu negocio",
  parrafo:
    "En una sala de uñas la plata no está en la clienta nueva, está en la que agenda el retoque antes de salir. Con Bookea Lealtad esa clienta se lleva su tarjeta en el Apple Wallet o el Google Wallet del teléfono: no se le arruga en la cartera, no se le pierde, y cada vez que abre el celular ve cuánto le falta para su regalía.",
  bullets: [
    "El sello lo pone la técnica desde el celular al terminar el servicio: nadie anda buscando el sellito ni mandando a imprimir cartoncitos nuevos cuando se acaban.",
    "La tarjeta vive en el Wallet con el nombre y los colores del salón, así que tu marca queda al lado de la tarjeta del banco y no en el fondo de una bolsa.",
    "Cuando la clienta se acerca a la meta le llega el aviso al teléfono: esa es la excusa perfecta para que agende la próxima cita con vos y no pruebe el salón de al lado.",
  ],
};

// ── El frasquito de esmalte ────────────────────────────────────────
// Tapa + cuerpo + reflejo. Un solo dibujo para los dos estados: lo que
// cambia son los colores y el brillo, no la forma — así el ojo lee «el
// mismo frasco, apagado y encendido» y no «dos íconos distintos».

function FrascoEsmalte({ encendido, lado = 20 }: { encendido: boolean; lado?: number }) {
  const tapa = encendido ? "#F4D9A8" : "#4A2438";
  const tapaAlta = encendido ? "#FFF2D6" : "#5C3047";
  const vidrio = encendido ? "#FF4F97" : "#3E1B30";
  const vidrioAlto = encendido ? "#FFB4D6" : "#6B3C55";
  const borde = encendido ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.16)";

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full transition-all duration-500"
      style={{
        width: lado + 8,
        height: lado + 8,
        background: encendido
          ? "radial-gradient(circle at 50% 38%, rgba(255,196,224,.34), rgba(255,255,255,.05) 68%, transparent 72%)"
          : "rgba(255,255,255,.04)",
        boxShadow: encendido
          ? "0 0 0 1px rgba(255,214,236,.5), 0 6px 16px -6px rgba(255,79,151,.8)"
          : "0 0 0 1px rgba(255,255,255,.07)",
      }}
    >
      <svg
        width={lado}
        height={lado}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        style={{
          filter: encendido
            ? "drop-shadow(0 1px 3px rgba(255,79,151,.65))"
            : "saturate(.35) brightness(.9)",
          opacity: encendido ? 1 : 0.5,
          transition: "filter .5s, opacity .5s",
        }}
      >
        {/* La tapa */}
        <rect x="9.1" y="1.6" width="5.8" height="6.2" rx="1.5" fill={tapa} />
        <rect x="10.1" y="2.4" width="1.5" height="4.4" rx="0.75" fill={tapaAlta} opacity=".9" />
        {/* El cuello */}
        <rect x="10.4" y="7.4" width="3.2" height="1.9" rx="0.5" fill={tapa} opacity=".75" />
        {/* El cuerpo del frasco */}
        <path
          d="M7.6 11.2c0-1.2.9-2.1 2-2.1h4.8c1.1 0 2 .9 2 2.1v8.6c0 1.4-1 2.5-2.3 2.5H9.9c-1.3 0-2.3-1.1-2.3-2.5v-8.6Z"
          fill={vidrio}
          stroke={borde}
          strokeWidth=".7"
        />
        {/* El reflejo del vidrio */}
        <path
          d="M9.6 11.6c0-.5.4-.9.9-.9s.8.4.8.9v7.6c0 .5-.4.9-.8.9s-.9-.4-.9-.9v-7.6Z"
          fill={vidrioAlto}
          opacity={encendido ? 0.85 : 0.35}
        />
        {/* El destello de la tapa, solo cuando ya está ganado */}
        {encendido ? <circle cx="15.4" cy="3.3" r="1.05" fill="#FFFFFF" opacity=".9" /> : null}
      </svg>
    </span>
  );
}

// ── El pase ────────────────────────────────────────────────────────

export default function PaseBelleza({
  sellos = 4,
  meta = 10,
}: {
  sellos?: number;
  meta?: number;
}) {
  const total = Math.max(1, Math.round(meta));
  const ganados = Math.min(Math.max(0, Math.round(sellos)), total);
  const faltan = total - ganados;
  const completa = faltan === 0;

  return (
    <div
      className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-[26px]"
      style={{
        background: "linear-gradient(158deg,#2B0A22 0%,#4A0E39 34%,#7A1150 62%,#3A0B3F 100%)",
        boxShadow:
          "0 26px 60px -22px rgba(58,8,40,.75), 0 0 0 1px rgba(255,214,236,.14), inset 0 1px 0 rgba(255,255,255,.16)",
      }}
    >
      {/* ── El patrón decorativo del fondo ──────────────────────────
          Ondas de nácar + brillitos, en SVG inline: sin imágenes ni
          dependencias, y siempre por debajo del texto. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 300 420"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="aura-onda" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFD9A8" stopOpacity=".30" />
            <stop offset="55%" stopColor="#FF9BC6" stopOpacity=".16" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="aura-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF6FA8" stopOpacity=".40" />
            <stop offset="100%" stopColor="#FF6FA8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* El halo de luz de la esquina */}
        <circle cx="256" cy="24" r="130" fill="url(#aura-halo)" />

        {/* Las ondas de nácar */}
        <path
          d="M-20 96C48 62 96 132 158 106 220 80 262 128 322 100"
          stroke="url(#aura-onda)"
          strokeWidth="1.4"
          fill="none"
        />
        <path
          d="M-20 130C44 96 100 166 160 138 222 110 264 158 322 132"
          stroke="url(#aura-onda)"
          strokeWidth="1.1"
          fill="none"
        />
        <path
          d="M-20 322C52 288 98 356 160 330 222 304 266 350 322 324"
          stroke="url(#aura-onda)"
          strokeWidth="1.4"
          fill="none"
        />
        <path
          d="M-20 356C52 322 98 390 160 364 222 338 266 384 322 358"
          stroke="url(#aura-onda)"
          strokeWidth="1.1"
          fill="none"
        />

        {/* Los brillos */}
        {BRILLOS.map(([cx, cy]) => (
          <path
            key={`${cx}-${cy}`}
            fill="#FFE9C9"
            opacity=".42"
            d={`M${cx} ${cy - 6}c.7 4.2 1.1 4.6 5.3 5.3-4.2.7-4.6 1.1-5.3 5.3-.7-4.2-1.1-4.6-5.3-5.3 4.2-.7 4.6-1.1 5.3-5.3Z`}
          />
        ))}
      </svg>

      {/* ── El contenido ────────────────────────────────────────── */}
      <div className="relative px-4 pt-4">
        {/* Encabezado: monograma + negocio a la izquierda, contador a la derecha */}
        <div className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[12px] font-black"
              style={{
                background: "linear-gradient(140deg,#FFEDD2,#E8BE86 55%,#C79A5C)",
                color: "#4A0E39",
                boxShadow: "0 3px 10px -3px rgba(0,0,0,.55)",
              }}
            >
              A
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold leading-tight text-white">
                {NEGOCIO}
              </span>
              <span
                className="block text-[8px] uppercase tracking-[.22em]"
                style={{ color: "#F2C9A0" }}
              >
                Nail studio
              </span>
            </span>
          </span>

          <span className="shrink-0 text-right">
            <span
              className="block text-[8.5px] uppercase tracking-[.16em]"
              style={{ color: "rgba(255,229,244,.75)" }}
            >
              Sellos
            </span>
            <span className="block text-[19px] font-extrabold leading-none text-white">
              {ganados}
              <span style={{ color: "rgba(255,229,244,.62)" }}>/{total}</span>
            </span>
          </span>
        </div>

        {/* ── La franja de sellos (proporción de Apple, 375×123) ── */}
        <div
          className="relative mt-3.5 overflow-hidden rounded-[14px]"
          style={{
            aspectRatio: "375 / 123",
            background:
              "linear-gradient(135deg,rgba(12,3,12,.55),rgba(122,17,80,.32) 55%,rgba(12,3,12,.5))",
            boxShadow: "inset 0 0 0 1px rgba(255,214,236,.18)",
          }}
        >
          <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-x-1 gap-y-0.5 px-2">
            {Array.from({ length: Math.min(total, 20) }, (_, i) => (
              <FrascoEsmalte key={i} encendido={i < ganados} lado={20} />
            ))}
          </div>
        </div>

        {/* Regalía y clienta */}
        <div className="mt-3.5 flex items-end justify-between gap-3">
          <span className="min-w-0">
            <span
              className="block text-[8.5px] uppercase tracking-[.16em]"
              style={{ color: "rgba(255,229,244,.75)" }}
            >
              Regalía
            </span>
            <span className="block truncate text-[12px] font-semibold text-white">{REGALIA}</span>
          </span>
          <span className="shrink-0 text-right">
            <span
              className="block text-[8.5px] uppercase tracking-[.16em]"
              style={{ color: "rgba(255,229,244,.75)" }}
            >
              Clienta
            </span>
            <span className="block text-[12px] font-semibold text-white">Valeria M.</span>
          </span>
        </div>

        {/* La línea de «te faltan» */}
        <p
          className="mt-3 rounded-full px-3 py-1.5 text-center text-[10.5px] font-bold"
          style={{
            background: completa
              ? "linear-gradient(120deg,#FFEDD2,#E8BE86)"
              : "rgba(255,255,255,.10)",
            color: completa ? "#4A0E39" : "#FFE3F1",
            boxShadow: completa
              ? "0 6px 18px -8px rgba(232,190,134,.9)"
              : "inset 0 0 0 1px rgba(255,214,236,.2)",
          }}
        >
          {completa
            ? "¡Tarjeta llena! Canjeá tu manicure de cortesía"
            : `Te ${faltan === 1 ? "falta" : "faltan"} ${faltan} ${faltan === 1 ? "esmalte" : "esmaltes"} para tu regalía`}
        </p>
      </div>

      {/* El código al pie: siempre sobre blanco, como en el pase real. */}
      <div className="relative mt-4 bg-white px-4 py-3">
        <CodigoDibujado semilla={NEGOCIO} lado={78} />
        <p className="mt-1.5 text-center text-[8.5px] text-[#53657f]">Powered by Bookea.lat</p>
      </div>
    </div>
  );
}

/** Dónde van los brillitos del fondo. Fijos: el patrón no puede bailar entre renders. */
const BRILLOS: ReadonlyArray<readonly [number, number]> = [
  [36, 58],
  [214, 46],
  [86, 208],
  [268, 236],
  [148, 388],
  [42, 356],
];

/**
 * El código del pase, dibujado (mismo criterio que la vista previa real):
 * el patrón sale del nombre del negocio y NO de `Math.random()`, porque
 * el servidor y el cliente tienen que pintar exactamente lo mismo.
 */
function CodigoDibujado({ semilla, lado }: { semilla: string; lado: number }) {
  const MODULOS = 21;
  const px = lado / MODULOS;

  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) {
    h = Math.imul(h ^ semilla.charCodeAt(i), 16777619) >>> 0;
  }

  const celdas: boolean[] = [];
  for (let i = 0; i < MODULOS * MODULOS; i++) {
    const f = Math.floor(i / MODULOS);
    const c = i % MODULOS;
    const enOjo = [
      [0, 0],
      [0, MODULOS - 7],
      [MODULOS - 7, 0],
    ].some(([of, oc]) => {
      const df = f - of;
      const dc = c - oc;
      if (df < 0 || df > 6 || dc < 0 || dc > 6) return false;
      const borde = df === 0 || df === 6 || dc === 0 || dc === 6;
      const centro = df >= 2 && df <= 4 && dc >= 2 && dc <= 4;
      return borde || centro;
    });
    const enHueco = [
      [0, 0],
      [0, MODULOS - 8],
      [MODULOS - 8, 0],
    ].some(([of, oc]) => f - of >= 0 && f - of <= 7 && c - oc >= 0 && c - oc <= 7);

    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    celdas.push(enOjo || (!enHueco && (h >>> 16) % 100 < 45));
  }

  return (
    <div
      aria-hidden
      className="mx-auto grid"
      style={{ gridTemplateColumns: `repeat(${MODULOS}, ${px}px)`, width: lado }}
    >
      {celdas.map((lleno, i) => (
        <span
          key={i}
          style={{ height: px, width: px, background: lleno ? "#2B0A22" : "transparent" }}
        />
      ))}
    </div>
  );
}
