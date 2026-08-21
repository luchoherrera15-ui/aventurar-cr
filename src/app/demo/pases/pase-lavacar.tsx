/**
 * PASE DEMO — LAVACAR «Aqua Detail».
 *
 * Utilería de venta: el negocio es FICTICIO y los datos son de muestra.
 * Dibuja SOLO la tarjeta (el teléfono lo pone la página que lo usa).
 *
 * La anatomía es la del pase real (ver src/components/lealtad/vista-pase.tsx):
 * encabezado con logo + nombre a la izquierda y el contador a la derecha,
 * la BANDA con la grilla de sellos en proporción 375×123 de Apple, los
 * campos de detalle y regalía, y el código sobre blanco al pie.
 * Lo que cambia acá es el vestido: degradado de carrocería mojada y
 * patrón de gotas/espuma dibujado en SVG inline.
 */

const NEGOCIO = "Aqua Detail";
const RUBRO = "Lavacar & estética automotriz";
const REGALIA = "Lavado premium con cera de gratis";

/** Paleta: agua profunda → turquesa, acento menta cromo. */
const AZUL_HONDO = "#031c2e";
const AZUL_MEDIO = "#07425f";
const TURQUESA = "#0e8ea3";
const MENTA = "#7ff2d8";
const CROMO = "#dff6ff";

export const COPY: {
  negocio: string;
  rubro: string;
  regalia: string;
  mecanica: string;
  titulo: string;
  parrafo: string;
  bullets: string[];
} = {
  negocio: NEGOCIO,
  rubro: RUBRO,
  regalia: REGALIA,
  mecanica: "10 lavados sellados y el siguiente es premium con cera, cortesía de la casa.",
  titulo: "El carro se vuelve a ensuciar. La pregunta es a cuál lavacar vuelve.",
  parrafo:
    "En un lavacar casi nadie decide por precio: deciden por costumbre y por cuál les queda de paso. El asunto es que esa costumbre no es de nadie hasta que alguien la premia. Con Bookea Lealtad el cliente se lleva la tarjeta de Aqua Detail en la billetera del teléfono, y cada lavado le suma un sello que ve al toque — sin cartoncito que se moje ni se pierda en la guantera.",
  bullets: [
    "Sin cartón: el pase vive en Apple Wallet y Google Wallet, y el sello se marca desde el celular del muchacho ahí mismo en la pista.",
    "El cliente ve cuánto le falta para el lavado premium, entonces el sábado se acuerda de ustedes y no del lavacar de la esquina.",
    "Ustedes escogen la regalía y la meta —lavado, aspirado, encerado— y la cambian cuando quieran sin reimprimir nada.",
  ],
};

export default function PaseLavacar({
  sellos = 4,
  meta = 10,
}: {
  sellos?: number;
  meta?: number;
}) {
  const total = Math.max(1, Math.floor(meta));
  const ganados = Math.min(Math.max(0, Math.floor(sellos)), total);
  const faltan = total - ganados;

  return (
    <div
      className="mx-auto w-full max-w-[300px] overflow-hidden rounded-3xl"
      style={{
        // Carrocería mojada: reflejo de agua arriba, laca honda al centro,
        // sombra bajo el chasis al pie.
        background: `radial-gradient(120% 85% at 12% 0%, rgba(127,242,216,.22) 0%, rgba(127,242,216,0) 55%),
           radial-gradient(95% 70% at 100% 18%, rgba(14,142,163,.55) 0%, rgba(14,142,163,0) 60%),
           linear-gradient(158deg, ${AZUL_MEDIO} 0%, ${AZUL_HONDO} 42%, #02121f 72%, ${AZUL_HONDO} 100%)`,
        boxShadow: "0 24px 55px -18px rgba(2,20,34,.75), inset 0 1px 0 rgba(255,255,255,.16)",
      }}
    >
      <div className="relative">
        <Gotas />

        {/* Barrido de luz: la línea de reflejo que corre sobre una lata
            recién enjuagada. Decorativo, va detrás del texto. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(112deg, rgba(255,255,255,0) 38%, rgba(255,255,255,.16) 47%, rgba(255,255,255,.03) 53%, rgba(255,255,255,0) 62%)",
          }}
        />

        <div className="relative px-4 pt-4">
          {/* Encabezado: marca a la izquierda, contador a la derecha. */}
          <div className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <LogoAqua />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-semibold leading-tight text-white">
                  {NEGOCIO}
                </span>
                <span className="block truncate text-[9px] uppercase tracking-[.14em] text-white/60">
                  Lavacar
                </span>
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[8.5px] uppercase tracking-wider text-white/60">
                Lavados
              </span>
              <span
                className="block text-[22px] font-extrabold leading-none"
                style={{ color: CROMO, textShadow: "0 0 14px rgba(127,242,216,.45)" }}
              >
                {ganados}
                <span className="text-[13px] font-bold text-white/55">/{total}</span>
              </span>
            </span>
          </div>

          {/* LA BANDA (strip 375×123): la grilla de sellos. */}
          <div
            className="relative mt-3 overflow-hidden rounded-xl"
            style={{
              aspectRatio: "375 / 123",
              background: "linear-gradient(180deg, rgba(2,18,31,.72) 0%, rgba(7,66,95,.55) 100%)",
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,.10), inset 0 10px 26px -14px rgba(127,242,216,.55)",
            }}
          >
            <Espuma />
            <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-[5px] px-3">
              {Array.from({ length: Math.min(total, 20) }, (_, i) => (
                <SelloCarro key={i} encendido={i < ganados} numero={i + 1} />
              ))}
            </div>
          </div>

          {/* La barra de avance: el mismo dato, leído de lejos. */}
          <div
            aria-hidden
            className="mt-3 h-[5px] w-full overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,.12)" }}
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${(ganados / total) * 100}%`,
                background: `linear-gradient(90deg, ${TURQUESA}, ${MENTA})`,
                boxShadow: "0 0 12px rgba(127,242,216,.6)",
              }}
            />
          </div>

          <div className="mt-3">
            <span className="block text-[8.5px] uppercase tracking-wider text-white/60">
              Cliente
            </span>
            <span className="block text-[12px] font-medium leading-snug text-white">
              Marianela Quirós
            </span>
          </div>

          <div className="mt-2.5">
            <span className="block text-[8.5px] uppercase tracking-wider text-white/60">
              Regalía
            </span>
            <span className="block text-[12px] font-bold" style={{ color: MENTA }}>
              {REGALIA}
            </span>
          </div>

          <p
            className="mt-3 rounded-lg px-2.5 py-1.5 text-center text-[10px] font-bold leading-snug text-white"
            style={{
              background: "rgba(255,255,255,.10)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)",
            }}
          >
            {faltan > 0
              ? `Te ${faltan === 1 ? "falta" : "faltan"} ${faltan} ${
                  faltan === 1 ? "lavado" : "lavados"
                } para tu premium con cera`
              : "¡Tarjeta completa! Pasá por tu lavado premium"}
          </p>
        </div>
      </div>

      {/* El código va sobre blanco: sobre el azul no se escanea. */}
      <div className="mt-4 bg-white px-4 py-3.5">
        <CodigoDibujado semilla={NEGOCIO} lado={86} />
        <p className="mt-1.5 text-center text-[8.5px] text-[#53657f]">Powered by Bookea.lat</p>
      </div>
    </div>
  );
}

// ── Decoración ─────────────────────────────────────────────────────

/** Gotas de agua sobre la pintura: el patrón del fondo de la tarjeta. */
function Gotas() {
  const gotas: Array<{ x: number; y: number; r: number; o: number }> = [
    { x: 12, y: 18, r: 9, o: 0.16 },
    { x: 46, y: 8, r: 5, o: 0.12 },
    { x: 78, y: 26, r: 12, o: 0.14 },
    { x: 118, y: 12, r: 4, o: 0.18 },
    { x: 150, y: 34, r: 7, o: 0.1 },
    { x: 196, y: 16, r: 10, o: 0.13 },
    { x: 236, y: 40, r: 5, o: 0.16 },
    { x: 268, y: 14, r: 8, o: 0.11 },
    { x: 22, y: 78, r: 6, o: 0.12 },
    { x: 62, y: 108, r: 11, o: 0.1 },
    { x: 104, y: 86, r: 4, o: 0.15 },
    { x: 172, y: 120, r: 8, o: 0.1 },
    { x: 214, y: 92, r: 5, o: 0.13 },
    { x: 258, y: 128, r: 10, o: 0.09 },
    { x: 34, y: 168, r: 7, o: 0.11 },
    { x: 128, y: 186, r: 5, o: 0.12 },
    { x: 222, y: 176, r: 9, o: 0.09 },
    { x: 284, y: 208, r: 6, o: 0.12 },
    { x: 16, y: 232, r: 10, o: 0.08 },
    { x: 96, y: 246, r: 4, o: 0.13 },
    { x: 186, y: 258, r: 7, o: 0.09 },
  ];

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 300 300"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <defs>
        <radialGradient id="aqua-detail-gota" cx="34%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="45%" stopColor="#bff3ff" stopOpacity=".35" />
          <stop offset="100%" stopColor="#0a4e6b" stopOpacity=".05" />
        </radialGradient>
      </defs>
      {gotas.map((g, i) => (
        <g key={i} opacity={g.o}>
          <circle cx={g.x} cy={g.y} r={g.r} fill="url(#aqua-detail-gota)" />
          <circle
            cx={g.x - g.r * 0.3}
            cy={g.y - g.r * 0.34}
            r={g.r * 0.24}
            fill="#ffffff"
            opacity=".85"
          />
        </g>
      ))}
    </svg>
  );
}

/** Espuma de jabón dentro de la banda de los sellos. */
function Espuma() {
  const burbujas: Array<{ x: number; y: number; r: number }> = [
    { x: 18, y: 96, r: 16 },
    { x: 44, y: 108, r: 10 },
    { x: 70, y: 100, r: 13 },
    { x: 104, y: 110, r: 8 },
    { x: 140, y: 102, r: 15 },
    { x: 178, y: 112, r: 9 },
    { x: 214, y: 100, r: 14 },
    { x: 252, y: 110, r: 10 },
    { x: 286, y: 98, r: 16 },
    { x: 322, y: 108, r: 11 },
    { x: 356, y: 100, r: 14 },
    { x: 62, y: 14, r: 7 },
    { x: 210, y: 10, r: 6 },
    { x: 320, y: 20, r: 9 },
  ];

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 375 123"
      preserveAspectRatio="none"
      fill="none"
    >
      {burbujas.map((b, i) => (
        <circle
          key={i}
          cx={b.x}
          cy={b.y}
          r={b.r}
          fill="#cbf4ff"
          opacity={i % 3 === 0 ? 0.1 : 0.06}
        />
      ))}
      <path
        d="M0 118 Q 46 104 92 118 T 184 118 T 276 118 T 368 118 L 375 123 L 0 123 Z"
        fill="#e8fbff"
        opacity=".1"
      />
    </svg>
  );
}

// ── El sello: un carro que se limpia ───────────────────────────────
/**
 * Apagado, el carro es una silueta hundida en el fondo —el carro sucio.
 * Encendido, el disco se prende en menta cromada, el carro pasa a azul
 * hondo y le sale el destello: se leen distintos de un vistazo, que es
 * todo lo que el cliente hace con la tarjeta.
 */
function SelloCarro({ encendido, numero }: { encendido: boolean; numero: number }) {
  return (
    <span
      className="relative grid h-[26px] w-[26px] place-items-center rounded-full"
      role="img"
      aria-label={`Lavado ${numero}: ${encendido ? "sellado" : "pendiente"}`}
      style={
        encendido
          ? {
              background: `linear-gradient(150deg, ${CROMO} 0%, ${MENTA} 48%, ${TURQUESA} 100%)`,
              boxShadow: "0 0 12px rgba(127,242,216,.65), inset 0 1px 0 rgba(255,255,255,.9)",
            }
          : {
              background: "rgba(255,255,255,.06)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16)",
            }
      }
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3.4 16.2v-2.1c0-.5.2-1 .6-1.3l1-.8 1.5-3.3c.3-.7 1-1.2 1.8-1.2h7.4c.8 0 1.5.5 1.8 1.2l1.5 3.3 1 .8c.4.3.6.8.6 1.3v2.1c0 .4-.3.7-.7.7h-1.1v.9c0 .5-.4.9-.9.9h-1c-.5 0-.9-.4-.9-.9v-.9H7.9v.9c0 .5-.4.9-.9.9H6c-.5 0-.9-.4-.9-.9v-.9H4.1a.7.7 0 0 1-.7-.7Z"
          fill={encendido ? AZUL_HONDO : "rgba(255,255,255,.26)"}
        />
        <path
          d="M6.6 12.1 7.8 9.3c.1-.3.4-.5.7-.5h7c.3 0 .6.2.7.5l1.2 2.8H6.6Z"
          fill={encendido ? MENTA : "rgba(255,255,255,.14)"}
        />
        <circle cx="7.4" cy="14.4" r="1.1" fill={encendido ? MENTA : "rgba(255,255,255,.12)"} />
        <circle cx="16.6" cy="14.4" r="1.1" fill={encendido ? MENTA : "rgba(255,255,255,.12)"} />
        {encendido ? (
          /* El destello del carro recién lavado. */
          <path
            d="M18.4 4.6l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6.6-1.5Z"
            fill="#ffffff"
          />
        ) : null}
      </svg>
    </span>
  );
}

// ── El código del pase, dibujado ───────────────────────────────────
/**
 * Un cuadrado macizo se lee como «imagen que no cargó». Con los tres
 * ojos de esquina el ojo lo reconoce al toque. El patrón sale de una
 * semilla fija —no de `Math.random()`— para que servidor y cliente
 * pinten lo mismo.
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
          style={{ height: px, width: px, background: lleno ? "#031c2e" : "transparent" }}
        />
      ))}
    </div>
  );
}

/** El logo del negocio ficticio: una gota con brillo. */
function LogoAqua() {
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center rounded-xl"
      aria-hidden
      style={{
        background: `linear-gradient(150deg, ${CROMO}, ${MENTA} 45%, ${TURQUESA})`,
        boxShadow: "0 4px 12px rgba(14,142,163,.5), inset 0 1px 0 rgba(255,255,255,.9)",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3.2c3.4 4 6.1 7.1 6.1 10.2A6.1 6.1 0 0 1 12 19.5a6.1 6.1 0 0 1-6.1-6.1c0-3.1 2.7-6.2 6.1-10.2Z"
          fill={AZUL_HONDO}
        />
        <path
          d="M9.6 13.6c0-1.4.8-2.6 1.6-3.6-1.9 1.3-3.1 2.6-3.1 4.1 0 .9.4 1.7 1 2.3-.3-.9-.5-1.8-.5-2.8Z"
          fill={CROMO}
          opacity=".85"
        />
      </svg>
    </span>
  );
}
