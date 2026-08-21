/**
 * PASE DEMO — CAFETERÍA.
 *
 * Utilería comercial: «Tostaduría Media Luna» NO existe, es un negocio
 * inventado para mostrar el producto. Cero datos reales, cero cifras
 * inventadas.
 *
 * Respeta la anatomía del pase de verdad (src/components/lealtad/
 * vista-pase.tsx): ancho de tarjeta, encabezado con logo a la izquierda
 * y saldo a la derecha, la BANDA en proporción 375×123 con los sellos
 * adentro, los campos de detalle y regalía debajo, y el código sobre
 * blanco al pie. Lo que cambia es el vestido: degradado espresso,
 * patrón de granos y vapor, y sellos que son tazas que se llenan.
 *
 * Dibuja SOLO la tarjeta. El teléfono lo pone la página.
 */

const CREMA = "#F6E7D2";
const ORO = "#E3B04B";

export const COPY = {
  negocio: "Tostaduría Media Luna",
  rubro: "Cafetería de especialidad",
  regalia: "El café número 10 va por la casa",
  mecanica: "Un sello por cada café; a los 10 sellos, el siguiente lo invita la casa.",
  titulo: "El cliente del café vuelve solo si le das un motivo",
  parrafo:
    "En una cafetería la compra es chica y pasa todos los días: casi nadie decide dónde tomarse el café de la mañana, lo decide la costumbre. El programa de lealtad convierte esa costumbre en algo que el cliente puede ver avanzar en el teléfono, y le da una razón concreta para pasar por su local y no por el de la esquina.",
  bullets: [
    "La tarjetita de cartón se moja, se pierde y se rellena de más; el pase vive en la billetera del teléfono y el sello lo da el barista desde el celular del mostrador.",
    "El cliente ve cuántos cafés le faltan cada vez que abre la billetera, así que la meta lo acompaña todo el día.",
    "Cuando llega a la meta le entra el aviso al teléfono y vuelve a reclamar la regalía — una visita más que no dependía de que se acordara.",
  ],
};

export default function PaseCafeteria({
  sellos = 4,
  meta = 10,
}: {
  sellos?: number;
  meta?: number;
}) {
  const total = Math.max(1, Math.min(meta, 20));
  const ganados = Math.max(0, Math.min(sellos, total));
  const faltan = total - ganados;

  return (
    <div
      className="mx-auto w-full max-w-[300px] overflow-hidden rounded-3xl"
      style={{
        background: "linear-gradient(158deg,#3A2015 0%,#24120B 42%,#140A06 78%,#0C0503 100%)",
        boxShadow:
          "0 26px 60px -20px rgba(20,10,6,.75), inset 0 1px 0 rgba(246,231,210,.16)",
      }}
    >
      <div className="relative">
        {/* Textura y luz: todo decorativo, nada que leer. */}
        <FondoCafe />

        <div className="relative px-4 pb-4 pt-4">
          {/* ── Encabezado: marca a la izquierda, saldo a la derecha ── */}
          <div className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <LogoMediaLuna />
              <span className="min-w-0">
                <span
                  className="block truncate text-[12.5px] font-semibold leading-tight"
                  style={{ color: CREMA }}
                >
                  {COPY.negocio}
                </span>
                <span
                  className="block text-[8px] uppercase tracking-[.18em]"
                  style={{ color: "rgba(246,231,210,.55)" }}
                >
                  {COPY.rubro}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span
                className="block text-[8.5px] uppercase tracking-[.16em]"
                style={{ color: "rgba(246,231,210,.6)" }}
              >
                Sellos
              </span>
              <span
                className="block text-[19px] font-extrabold leading-none text-white"
                style={{ textShadow: "0 1px 8px rgba(227,176,75,.45)" }}
              >
                {ganados}
                <span className="text-[13px] font-bold" style={{ color: "rgba(246,231,210,.65)" }}>
                  /{total}
                </span>
              </span>
            </span>
          </div>

          {/* ── La banda: la proporción real del strip de Apple ─────── */}
          <div
            className="relative mt-3 overflow-hidden rounded-xl"
            style={{
              aspectRatio: "375 / 123",
              background: "linear-gradient(140deg,#4A2A1A 0%,#2A150D 48%,#1A0C06 100%)",
              boxShadow:
                "inset 0 0 0 1px rgba(227,176,75,.22), inset 0 12px 28px -14px rgba(255,214,150,.35)",
            }}
          >
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 90% at 15% -10%, rgba(255,201,120,.22), transparent 62%)",
              }}
            />
            <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-1.5 px-2.5">
              {Array.from({ length: total }, (_, i) => (
                <TazaSello key={i} encendido={i < ganados} />
              ))}
            </div>
          </div>

          {/* ── Los campos ─────────────────────────────────────────── */}
          <div className="mt-3">
            <span
              className="block text-[8.5px] uppercase tracking-[.16em]"
              style={{ color: "rgba(246,231,210,.6)" }}
            >
              Cómo funciona
            </span>
            <span
              className="block text-[11.5px] leading-snug"
              style={{ color: "rgba(255,255,255,.92)" }}
            >
              {COPY.mecanica}
            </span>
          </div>

          <div className="mt-2.5">
            <span
              className="block text-[8.5px] uppercase tracking-[.16em]"
              style={{ color: "rgba(246,231,210,.6)" }}
            >
              Regalía
            </span>
            <span className="block text-[12px] font-semibold" style={{ color: ORO }}>
              {COPY.regalia}
            </span>
          </div>

          <p
            className="mt-3 rounded-lg px-2.5 py-1.5 text-center text-[10.5px] font-bold"
            style={{
              background: "rgba(227,176,75,.14)",
              color: CREMA,
              boxShadow: "inset 0 0 0 1px rgba(227,176,75,.28)",
            }}
          >
            {faltan > 0
              ? `Te ${faltan === 1 ? "falta" : "faltan"} ${faltan} ${
                  faltan === 1 ? "café" : "cafés"
                } para tu regalía`
              : "¡Tarjeta completa! Tu próximo café va por la casa"}
          </p>
        </div>
      </div>

      {/* El código va sobre blanco siempre: es lo único que de verdad
          tiene que escanearse. */}
      <div className="qr-claro bg-white px-4 py-3.5">
        <CodigoDibujado semilla={COPY.negocio} lado={86} />
        <p className="mt-1.5 text-center text-[8.5px] text-[#53657f]">Powered by Bookea.lat</p>
      </div>
    </div>
  );
}

/* ── Fondo: degradado + patrón de granos, vapor y latte art ────────── */

function FondoCafe() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* La luz cálida que entra por arriba, y un reflejo verde matcha
          abajo a la izquierda para que el marrón no se aplane. */}
      <span
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 70% at 85% -15%, rgba(255,196,110,.28), transparent 58%)," +
            "radial-gradient(90% 60% at 0% 105%, rgba(90,196,140,.14), transparent 60%)",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ opacity: 0.22 }}
        viewBox="0 0 300 420"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        focusable="false"
      >
        <defs>
          <pattern id="pc-granos" width="46" height="46" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={ORO} strokeWidth="1.1" strokeLinecap="round">
              {/* Un grano de café: elipse inclinada con la hendidura. */}
              <g transform="translate(11 11) rotate(-28)">
                <ellipse rx="6.4" ry="4.1" />
                <path d="M-5.6 0c1.9-2.1 3.4-2.1 5.6 0s3.7 2.1 5.6 0" />
              </g>
              <g transform="translate(34 33) rotate(22)">
                <ellipse rx="6.4" ry="4.1" />
                <path d="M-5.6 0c1.9-2.1 3.4-2.1 5.6 0s3.7 2.1 5.6 0" />
              </g>
            </g>
          </pattern>
        </defs>
        <rect width="300" height="420" fill="url(#pc-granos)" />
        {/* Volutas de vapor: grandes y tenues, dan profundidad sin
            pelearse con el texto. */}
        <g fill="none" stroke={CREMA} strokeOpacity=".3" strokeWidth="1.6" strokeLinecap="round">
          <path d="M232 -10c-16 22 16 38 0 60s16 38 0 60" />
          <path d="M262 -18c-14 20 14 34 0 54s14 34 0 54" />
          <path d="M28 300c-14 20 14 34 0 54s14 34 0 54" />
        </g>
      </svg>
      {/* Latte art: la espiral apenas insinuada en la esquina. */}
      <svg
        className="absolute -bottom-6 -right-5 h-[150px] w-[150px]"
        style={{ opacity: 0.13 }}
        viewBox="0 0 100 100"
        aria-hidden
        focusable="false"
      >
        <path
          d="M50 8a42 42 0 1 1-.1 84 34 34 0 1 0 .1-68 26 26 0 1 1 0 52 18 18 0 1 0 0-36"
          fill="none"
          stroke={CREMA}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/* ── El logo del negocio, dibujado: media luna sobre oro ───────────── */

function LogoMediaLuna() {
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
      style={{
        background: "linear-gradient(140deg,#F3D08A,#C9922F 62%,#8A5E17)",
        boxShadow: "0 3px 10px rgba(227,176,75,.4), inset 0 1px 0 rgba(255,255,255,.5)",
      }}
      aria-hidden
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" focusable="false">
        <path
          d="M15.6 3.4a9 9 0 1 0 5 12.2 7.2 7.2 0 0 1-5-12.2Z"
          fill="#2A150D"
          fillOpacity=".85"
        />
        <path
          d="M8 14h5.6"
          stroke="#2A150D"
          strokeOpacity=".85"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/* ── El sello: una taza que se llena ───────────────────────────────── */
/**
 * ENCENDIDA: disco de porcelana crema, café adentro, aro dorado y halo
 * — se lee «servida». APAGADA: solo el contorno tenue sobre el hueco
 * oscuro, sin relleno ni vapor. Lo que cambia no es apenas el color
 * sino el PESO (macizo vs. línea), y por eso se distingue de lejos.
 */
function TazaSello({ encendido }: { encendido: boolean }) {
  const trazo = encendido ? "#3A2015" : "rgba(246,231,210,.42)";

  return (
    <span
      className="grid h-[22px] w-[22px] place-items-center rounded-full"
      style={
        encendido
          ? {
              background: "linear-gradient(145deg,#FFF6E7,#EFD3A4 70%,#D9AF62)",
              boxShadow:
                "0 0 0 1.5px rgba(227,176,75,.9), 0 0 10px rgba(255,201,120,.55), inset 0 1px 0 rgba(255,255,255,.85)",
            }
          : {
              background: "rgba(20,10,6,.5)",
              boxShadow: "inset 0 0 0 1px rgba(246,231,210,.24)",
            }
      }
      aria-hidden
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" focusable="false">
        {/* Cuerpo de la taza */}
        <path
          d="M4.5 8.5h12v5.5a6 6 0 0 1-12 0V8.5Z"
          fill={encendido ? "#4A2A18" : "none"}
          stroke={trazo}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        {/* Asa */}
        <path
          d="M16.5 9.6h1.6a2.6 2.6 0 0 1 0 5.2h-1.6"
          stroke={trazo}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        {/* Platillo */}
        <path d="M3 20.5h15" stroke={trazo} strokeWidth="1.7" strokeLinecap="round" />
        {/* Vapor: solo cuando ya está servida */}
        {encendido ? (
          <path
            d="M8.4 5.6c-.9-1 .9-1.8 0-2.8M12.4 5.6c-.9-1 .9-1.8 0-2.8"
            stroke="#8A5E17"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
    </span>
  );
}

/* ── El código del pase, dibujado ──────────────────────────────────── */
/**
 * Determinista a partir del nombre (nada de Math.random): el servidor y
 * el cliente tienen que pintar exactamente lo mismo o React tira
 * hydration mismatch.
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
          style={{ height: px, width: px, background: lleno ? "#1A0C06" : "transparent" }}
        />
      ))}
    </div>
  );
}
