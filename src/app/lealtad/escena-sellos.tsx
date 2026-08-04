import "./escena-sellos.css";

/**
 * La escena animada de /lealtad: la misma técnica que Reel.tsx en
 * /invitaciones (mockup de teléfono + conector + panel "en vivo", todo
 * en loop por CSS, sin JavaScript) pero con su propio cuento y su
 * propia hoja de estilos (escena-sellos.css, prefijo `sello-`) para no
 * pisar las animaciones `invitacion-*` ni las de ninguna otra escena.
 *
 * El loop: la tarjeta de sellos de "Café La Esquina" está en 9 de 10,
 * el cajero la escanea al cobrar, el décimo sello aparece con un pop,
 * la recompensa se desbloquea y el panel del negocio se actualiza
 * solo — el contador de canjes sube y le entra la fila del canje.
 * Después la escena se resetea y vuelve a arrancar.
 *
 * Autónomo: no recibe props, arma su propia duración (--sello-dur) en
 * un div contenedor. Quien lo importe solo necesita <EscenaSellos />.
 */

export default function EscenaSellos() {
  return (
    <div
      aria-hidden
      style={{ "--sello-dur": "8s" } as React.CSSProperties}
      className="flex flex-col items-center gap-6"
    >
      <TelefonoSellos />
      <ConectorCanje />
      <div className="w-[280px] sm:w-[320px]">
        <PanelNegocio />
      </div>
    </div>
  );
}

/** Un cheque simple, sin depender de otra carpeta. */
function Check({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

/** Ícono de QR chiquito para el indicador de "escaneando". */
function IconQR({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <path d="M14 14h3v3h-3zM20 14v3M17 20h4" />
    </svg>
  );
}

/** El teléfono con la tarjeta digital de sellos de "Café La Esquina":
 *  9 de 10 marcados al arrancar, se ve el escaneo al cobrar, el
 *  décimo sello aparece con un pop y la recompensa se desbloquea. */
function TelefonoSellos() {
  return (
    <div
      className="relative h-[430px] w-[248px] rounded-[40px] p-[9px] sm:h-[460px] sm:w-[262px]"
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
        {/* La isla dinámica */}
        <div
          className="absolute left-1/2 top-2 z-10 h-[15px] w-[76px] -translate-x-1/2 rounded-xl"
          style={{ background: "#050810" }}
        />

        <div className="flex h-full flex-col px-5 pb-6 pt-11 text-white">
          <p className="text-center text-[9px] font-bold uppercase tracking-[0.28em] text-white/40">
            Bookea Lealtad
          </p>

          {/* La tarjeta */}
          <div
            className="relative mt-4 flex-1 rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,.06)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-extrabold">Café La Esquina</span>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold"
                style={{ background: "#ee7420" }}
              >
                B
              </span>
            </div>
            <p className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-white/45">
              Cliente frecuente
            </p>

            {/* La grilla de 10 sellos: 9 marcados, el décimo hace pop */}
            <div className="mt-4 grid grid-cols-5 gap-2">
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  className="flex aspect-square items-center justify-center rounded-full text-white"
                  style={{ background: "#ee7420" }}
                >
                  <Check className="h-3 w-3" />
                </span>
              ))}
              <span className="relative aspect-square">
                <span
                  className="absolute inset-0 rounded-full border-2 border-dashed"
                  style={{ borderColor: "rgba(255,255,255,.32)" }}
                />
                <span
                  className="anim-sello-pop absolute inset-0 flex items-center justify-center rounded-full text-white"
                  style={{ background: "#ee7420" }}
                >
                  <Check className="h-3 w-3" />
                </span>
              </span>
            </div>

            {/* Zona fija: el indicador de escaneo y el badge de
                recompensa se turnan en el mismo lugar, sin mover el
                layout. */}
            <div className="relative mt-4 h-[52px]">
              <div
                className="anim-sello-tap absolute inset-0 flex items-center justify-center gap-2 rounded-xl opacity-0"
                style={{ background: "rgba(255,255,255,.07)" }}
              >
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <span
                    className="anim-sello-ping absolute h-3.5 w-3.5 rounded-full"
                    style={{ background: "rgba(238,116,32,.55)" }}
                  />
                  <IconQR className="relative h-4 w-4 text-[#ee7420]" />
                </span>
                <span className="text-[11px] font-bold text-white/80">
                  Escaneando el QR…
                </span>
              </div>

              <div
                className="anim-sello-badge absolute inset-0 flex items-center justify-center gap-1.5 rounded-xl text-center text-[11.5px] font-extrabold text-white"
                style={{ background: "#1f7a4d" }}
              >
                ☕ Café gratis desbloqueado
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[9px] font-semibold text-white/45">
            Se completa sola en cada visita
          </p>
        </div>
      </div>
    </div>
  );
}

/** El conector entre el teléfono y el panel: el puntito que viaja
 *  apenas se registra el sello, apuntando hacia abajo porque la
 *  escena queda apilada (igual patrón que ConectorViaje en Reel.tsx). */
function ConectorCanje() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-[64px] w-[64px] items-center justify-center">
        <div className="flex rotate-90 items-center gap-1" style={{ color: "#ee7420" }}>
          <div className="relative h-2 w-14">
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current opacity-25" />
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="anim-sello-viaje absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-current opacity-0"
                style={
                  {
                    "--sello-delay": `${i * 0.12}s`,
                    "--sello-viaje": "44px",
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
      </div>
      <p
        className="rounded-lg px-3.5 py-1.5 text-[11px] font-extrabold text-white/70"
        style={{ background: "rgba(255,255,255,.06)" }}
      >
        Registrado al instante
      </p>
    </div>
  );
}

/** El panel de vidrio del negocio: contador de canjes que sube solo y
 *  la fila del canje que le entra, igual patrón que PanelAnfitrion. */
function PanelNegocio() {
  return (
    <div
      className="rounded-2xl border border-white/12 p-5 backdrop-blur-xl"
      style={{ background: "rgba(22,41,94,.72)", boxShadow: "0 40px 90px -40px rgba(0,0,0,.85)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
          Tu panel, en vivo
        </p>
        <span
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "#5fd39a" }}
        >
          <span
            className="anim-sello-latir h-[5px] w-[5px] rounded-full"
            style={{ background: "#5fd39a" }}
          />
          En vivo
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5 text-white">
        <span className="titulo relative h-10 w-[1.6ch] overflow-hidden text-[38px] leading-none">
          <span className="anim-sello-num-sale absolute inset-0">11</span>
          <span
            className="anim-sello-num-entra absolute inset-0"
            style={{ color: "#5fd39a" }}
          >
            12
          </span>
        </span>
        <span className="text-[12.5px] text-white/55">canjes hoy</span>
      </div>

      <div className="mt-4 space-y-2">
        <FilaCanje iniciales="MJ" nombre="María J." detalle="+1 sello" />
        <FilaCanje iniciales="RB" nombre="Roberto B." detalle="+1 sello" />
        <FilaCanje iniciales="CE" nombre="Camila E." detalle="canjeó su recompensa" animada />
      </div>
    </div>
  );
}

/** Una fila del panel; la `animada` entra sola en el mismo compás que
 *  el pop del décimo sello. */
function FilaCanje({
  iniciales,
  nombre,
  detalle,
  animada,
}: {
  iniciales: string;
  nombre: string;
  detalle: string;
  animada?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${animada ? "anim-sello-entrar" : ""}`}
      style={{ background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white/80"
        style={{ background: "linear-gradient(140deg,#3a4a7a,#1c2748)" }}
      >
        {iniciales}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">{nombre}</span>
      <span className="shrink-0 text-[11px] font-bold" style={{ color: "#5fd39a" }}>
        {detalle}
      </span>
    </div>
  );
}
