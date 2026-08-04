import { IconCheck, IconStar } from "@/components/icons";

/**
 * Escena "Eventos" de /publicar, versión oscura: la misma técnica de
 * TelefonoSellos (src/app/lealtad/escena-sellos.tsx) para el bisel del
 * teléfono, pero con las animaciones `publicar-*` que ya existen en
 * globals.css (una sola pasada, `1 both` — la escena se congela en su
 * estado final, no es un loop). El contenido y el copy son un calco
 * exacto de la versión clara que vivía en page.tsx: el cliente elige
 * el 3 de agosto para "Rancho Las Torres" y el dueño aprueba la
 * reserva con un toque.
 *
 * Autónomo: no recibe props, arma sus propias variables --pub-* en un
 * div contenedor. Quien lo importe solo necesita <EscenaEventos />.
 */

const VARS_EVENTOS = {
  "--pub-dur": "9s",
  "--pub-acento": "#ee7420",
  "--pub-fondo-acento": "rgba(238,116,32,.16)",
  "--pub-tinta-acento": "#ffffff",
  "--pub-reposo": "rgba(255,255,255,.06)",
  "--pub-tinta": "rgba(255,255,255,.92)",
  "--pub-linea": "rgba(255,255,255,.18)",
} as React.CSSProperties;

export default function EscenaEventos() {
  return (
    <div
      aria-hidden
      style={VARS_EVENTOS}
      className="flex flex-col items-center justify-center gap-5 md:flex-row md:gap-4"
    >
      <TelefonoEventos etiqueta="Tu cliente elige la fecha">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/12 text-[10.5px] font-extrabold text-white">
            RT
          </span>
          <div>
            <p className="text-[12.5px] font-extrabold leading-tight text-white">
              Rancho Las Torres
            </p>
            <p className="flex items-center gap-1 text-[9.5px] font-semibold text-white/60">
              <IconStar className="h-2.5 w-2.5 text-[#ee7420]" />
              4.8 · Lugares · Alajuela
            </p>
          </div>
        </div>

        <p className="mt-3 text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-[#ee7420]">
          Agosto
        </p>
        <div className="mt-1.5 grid grid-cols-7 gap-1 text-center">
          {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="text-[8px] font-extrabold text-white/45"
            >
              {d}
            </span>
          ))}
          {Array.from({ length: 14 }, (_, i) => i + 1).map((dia) =>
            dia === 3 ? (
              <span
                key={dia}
                className="anim-publicar-seleccionar flex h-6 items-center justify-center rounded-md text-[9.5px] font-extrabold"
                style={{ "--pub-delay": "0.2s" } as React.CSSProperties}
              >
                {dia}
              </span>
            ) : (
              <span
                key={dia}
                className="flex h-6 items-center justify-center rounded-md text-[9.5px] font-bold text-white/80"
              >
                {dia}
              </span>
            ),
          )}
        </div>

        <div
          className="mt-3 rounded-lg px-2.5 py-2"
          style={{ background: "rgba(255,255,255,.06)" }}
        >
          <p className="text-[10px] font-extrabold text-white">
            Lunes 3 de agosto
          </p>
          <p className="text-[9px] font-semibold text-white/60">
            Fiesta · 80 personas
          </p>
        </div>

        <div
          className="anim-publicar-pulsar mt-3 rounded-lg py-2 text-center text-[11.5px] font-extrabold text-white"
          style={{ background: "#ee7420", "--pub-delay": "0.3s" } as React.CSSProperties}
        >
          Reservar
        </div>

        <div
          className="anim-publicar-entrar mt-auto flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-white"
          style={{ background: "rgba(255,255,255,.1)", "--pub-delay": "0.5s" } as React.CSSProperties}
        >
          <IconCheck className="h-3 w-3 shrink-0" />
          <span className="text-[10.5px] font-extrabold">Reserva enviada</span>
        </div>
      </TelefonoEventos>

      <ConectorFlujo texto="y vos la aprobás con un toque" />

      <TelefonoEventos etiqueta="Y vos la aprobás">
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] font-extrabold text-white">
            Panel de reservas
          </p>
          <span className="text-[9.5px] font-bold text-white/55">
            Rancho Las Torres
          </span>
        </div>

        <div
          className="mt-2.5 rounded-lg px-2.5 py-2"
          style={{
            background: "rgba(255,255,255,.06)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)",
          }}
        >
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10.5px] font-extrabold text-white">
              Boda de Laura
            </p>
            <span
              className="rounded-lg px-1.5 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wide"
              style={{ background: "rgba(95,211,154,.18)", color: "#5fd39a" }}
            >
              Aprobada
            </span>
          </div>
          <p className="mt-0.5 text-[9px] font-semibold text-white/55">
            12 de julio · 120 personas
          </p>
        </div>

        <div
          className="anim-publicar-entrar mt-2 rounded-xl p-2.5"
          style={{
            background: "rgba(255,255,255,.07)",
            boxShadow: "inset 0 0 0 1.5px rgba(238,116,32,.55)",
            "--pub-delay": "0.4s",
          } as React.CSSProperties}
        >
          <span
            className="rounded-lg px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide"
            style={{ background: "rgba(238,116,32,.2)", color: "#ee7420" }}
          >
            Nueva reserva
          </span>
          <p className="mt-1.5 text-[11px] font-extrabold text-white">
            Rancho Las Torres · 3 de agosto
          </p>
          <p className="mt-0.5 text-[9px] font-semibold text-white/60">
            María J. · 80 personas · Depósito ₡75 000
          </p>
          <div className="mt-2 flex gap-1.5">
            <span
              className="anim-publicar-pulsar flex-1 rounded-lg py-1.5 text-center text-[10px] font-extrabold text-white"
              style={{ background: "#1f7a4d", "--pub-delay": "1.8s" } as React.CSSProperties}
            >
              Aprobar
            </span>
            <span
              className="flex-1 rounded-lg py-1.5 text-center text-[10px] font-bold text-white/60"
              style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16)" }}
            >
              Ver detalle
            </span>
          </div>
        </div>

        <div
          className="anim-publicar-entrar mt-auto flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-white"
          style={{ background: "#1f7a4d", "--pub-delay": "1.4s" } as React.CSSProperties}
        >
          <IconCheck className="h-3 w-3 shrink-0" />
          <span className="text-[10.5px] font-extrabold">Reserva aprobada</span>
          <span className="ml-auto text-[9px] opacity-80">
            Se le avisó al cliente
          </span>
        </div>
      </TelefonoEventos>
    </div>
  );
}

/** El bisel de teléfono oscuro, calcado de TelefonoSellos en
 *  /lealtad/escena-sellos.tsx, con la etiqueta debajo como hace
 *  Telefono en page.tsx. */
function TelefonoEventos({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <div
        className="relative h-[430px] w-[248px] rounded-[40px] p-[9px]"
        style={{
          background: "#050810",
          boxShadow:
            "0 0 0 2px #1c2436, 0 0 0 3.5px #2e3a52, 0 50px 100px -35px rgba(0,0,0,.85)",
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-[32px]"
          style={{ background: "#0a1226" }}
        >
          <div
            aria-hidden
            className="absolute left-1/2 top-2 z-10 h-[15px] w-[76px] -translate-x-1/2 rounded-xl"
            style={{ background: "#050810" }}
          />
          <div className="flex h-full flex-col px-3 pb-3 pt-8">
            {children}
          </div>
        </div>
      </div>
      <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-white/45">
        {etiqueta}
      </p>
    </div>
  );
}

/** El conector entre los dos teléfonos: puntitos que laten en
 *  secuencia, calcado de ConectorFlujo en page.tsx pero en blanco/naranja
 *  para leerse sobre el fondo navy. */
function ConectorFlujo({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center gap-2 self-center text-[#ee7420]">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="anim-publicar-punto h-2 w-2 rounded-full bg-current"
            style={{ "--pub-delay": `${i * 0.3}s` } as React.CSSProperties}
          />
        ))}
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
      <p className="max-w-[16ch] text-center text-[11px] font-bold leading-snug text-white/70">
        {texto}
      </p>
    </div>
  );
}
