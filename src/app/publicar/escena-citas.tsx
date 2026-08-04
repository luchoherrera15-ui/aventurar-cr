import { IconCalendarLine, IconCheck, IconStar } from "@/components/icons";

/**
 * La escena de Citas de /publicar, vestida de oscuro (línea navy tipo
 * Apple, igual que /lealtad y /invitaciones). Mismo contenido y misma
 * animación CSS (keyframes publicar-* en globals.css, ya existentes,
 * NO se tocan) que la versión clara de page.tsx — solo cambia el
 * vestuario: bisel de teléfono oscuro (calcado de TelefonoSellos en
 * /lealtad/escena-sellos.tsx) y tarjetas de vidrio en vez de blancas.
 *
 * Autónomo: no recibe props, define sus propias variables --pub-* en
 * el div contenedor. Quien lo importe solo necesita <EscenaCitas />.
 */

const VARS_CITAS = {
  "--pub-dur": "8s",
  "--pub-acento": "#3b7fc4",
  "--pub-fondo-acento": "rgba(59,127,196,.22)",
  "--pub-tinta-acento": "#ffffff",
  "--pub-linea": "rgba(255,255,255,.18)",
  "--pub-reposo": "rgba(255,255,255,.06)",
  "--pub-tinta": "#ffffff",
} as React.CSSProperties;

export default function EscenaCitas() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 text-white/70 md:flex-row md:gap-4"
      style={VARS_CITAS}
    >
      <TelefonoCitas etiqueta="Tu cliente reserva">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10.5px] font-extrabold text-white"
            style={{ background: "linear-gradient(140deg,#3a4a7a,#1c2748)" }}
          >
            UK
          </span>
          <div>
            <p className="text-[12.5px] font-extrabold leading-tight text-white">
              Uñas Kathy
            </p>
            <p className="flex items-center gap-1 text-[9.5px] font-semibold text-white/55">
              <IconStar className="h-2.5 w-2.5 text-[#ee7420]" />
              4.9 · Uñas · San José
            </p>
          </div>
        </div>

        <p className="mt-3 text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-white/45">
          Elegí tu servicio
        </p>
        <div className="mt-1.5 space-y-1.5">
          <div
            className="anim-publicar-seleccionar flex items-center justify-between rounded-lg px-2.5 py-2"
            style={{ "--pub-delay": "0.2s" } as React.CSSProperties}
          >
            <span className="text-[11px] font-extrabold">Manicura</span>
            <span className="text-[9.5px] font-semibold">45 min · ₡12 000</span>
          </div>
          <FilaServicioCitas nombre="Pedicura" detalle="60 min · ₡15 000" />
          <FilaServicioCitas nombre="Uñas acrílicas" detalle="90 min · ₡22 000" />
        </div>

        <p className="mt-3 text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-white/45">
          Elegí la hora
        </p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <ChipHoraCitas hora="10:00" />
          <span
            className="anim-publicar-seleccionar rounded-lg py-1.5 text-center text-[10.5px] font-extrabold"
            style={{ "--pub-delay": "1.3s" } as React.CSSProperties}
          >
            10:30
          </span>
          <ChipHoraCitas hora="11:00" />
        </div>

        <div
          className="anim-publicar-pulsar mt-3 rounded-lg py-2 text-center text-[11.5px] font-extrabold text-white"
          style={{ "--pub-delay": "0.2s", background: "#3b7fc4" } as React.CSSProperties}
        >
          Reservar
        </div>

        <div
          className="anim-publicar-entrar mt-auto flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-white"
          style={{ "--pub-delay": "0.3s", background: "#1f7a4d" } as React.CSSProperties}
        >
          <IconCheck className="h-3 w-3 shrink-0" />
          <span className="text-[10.5px] font-extrabold">¡Cita confirmada!</span>
          <span className="ml-auto text-[9px] opacity-80">Hoy · 10:30</span>
        </div>
      </TelefonoCitas>

      <ConectorFlujoCitas texto="y le llega al instante al dueño" />

      <TelefonoCitas etiqueta="Y a vos te llega">
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] font-extrabold text-white">Tu agenda</p>
          <span className="text-[9.5px] font-bold text-white/55">Hoy · martes</span>
        </div>

        <div
          className="anim-publicar-entrar mt-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
          style={{
            "--pub-delay": "0.5s",
            background: "rgba(59,127,196,.22)",
          } as React.CSSProperties}
        >
          <IconCalendarLine className="h-3 w-3 shrink-0 text-[#3b7fc4]" />
          <span className="text-[9.5px] font-extrabold text-white">
            Nueva reserva de María P.
          </span>
        </div>

        <div className="mt-3 space-y-1.5">
          <FilaAgendaCitas hora="9:00">
            <div
              className="rounded-lg border-l-[3px] px-2.5 py-2"
              style={{
                borderColor: "rgba(255,255,255,.18)",
                background: "rgba(255,255,255,.06)",
              }}
            >
              <p className="text-[10.5px] font-extrabold text-white">Ana R.</p>
              <p className="text-[9px] font-semibold text-white/55">
                Pedicura · 60 min
              </p>
            </div>
          </FilaAgendaCitas>
          <FilaAgendaCitas hora="10:00">
            <div
              className="rounded-lg border border-dashed px-2.5 py-2 text-[9px] font-semibold text-white/45"
              style={{ borderColor: "rgba(255,255,255,.22)" }}
            >
              Libre
            </div>
          </FilaAgendaCitas>
          <FilaAgendaCitas hora="10:30">
            <div
              className="anim-publicar-entrar rounded-lg border-l-[3px] px-2.5 py-2"
              style={
                {
                  "--pub-delay": "0.7s",
                  borderColor: "#3b7fc4",
                  background: "rgba(59,127,196,.18)",
                } as React.CSSProperties
              }
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-[10.5px] font-extrabold text-white">María P.</p>
                <span className="rounded-lg bg-[#3b7fc4] px-1.5 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wide text-white">
                  Cita confirmada
                </span>
              </div>
              <p className="mt-0.5 text-[9px] font-semibold text-white/55">
                Manicura · 45 min · ₡12 000
              </p>
            </div>
          </FilaAgendaCitas>
          <FilaAgendaCitas hora="11:30">
            <div
              className="rounded-lg border-l-[3px] px-2.5 py-2"
              style={{
                borderColor: "rgba(255,255,255,.18)",
                background: "rgba(255,255,255,.06)",
              }}
            >
              <p className="text-[10.5px] font-extrabold text-white">Sofía M.</p>
              <p className="text-[9px] font-semibold text-white/55">
                Uñas acrílicas · 90 min
              </p>
            </div>
          </FilaAgendaCitas>
        </div>
      </TelefonoCitas>
    </div>
  );
}

/** El bisel de teléfono oscuro, calcado de TelefonoSellos en
 *  /lealtad/escena-sellos.tsx. */
function TelefonoCitas({
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
          <div className="flex h-full flex-col px-3 pb-3 pt-11 text-white">
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
 *  secuencia, en naranja de marca sobre fondo oscuro. */
function ConectorFlujoCitas({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center gap-2 self-center">
      <div className="flex items-center gap-1.5 text-[#ee7420]">
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

/** Fila de servicio en reposo del mockup de Citas. */
function FilaServicioCitas({
  nombre,
  detalle,
}: {
  nombre: string;
  detalle: string;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-2.5 py-2"
      style={{
        background: "rgba(255,255,255,.06)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)",
      }}
    >
      <span className="text-[11px] font-bold text-white">{nombre}</span>
      <span className="text-[9.5px] font-semibold text-white/55">{detalle}</span>
    </div>
  );
}

/** Chip de hora en reposo del mockup de Citas. */
function ChipHoraCitas({ hora }: { hora: string }) {
  return (
    <span
      className="rounded-lg py-1.5 text-center text-[10.5px] font-bold text-white"
      style={{
        background: "rgba(255,255,255,.06)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)",
      }}
    >
      {hora}
    </span>
  );
}

/** Fila de la agenda del dueño: la hora al margen y la tarjeta al lado. */
function FilaAgendaCitas({
  hora,
  children,
}: {
  hora: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <span className="w-8 shrink-0 pt-1.5 text-right text-[8.5px] font-bold text-white/45">
        {hora}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
