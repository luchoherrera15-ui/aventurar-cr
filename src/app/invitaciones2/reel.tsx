/**
 * La escena de "cómo funciona": ya NO es un tramo de scroll fijado.
 *
 * Antes había que bajar por una pista de varios largos de pantalla para
 * que la invitación se fuera transformando cuadro a cuadro — quedaba
 * lento y, si el navegador no llegaba a calcular bien el alto de la
 * pista, el teléfono ni se veía. Ahora es un bloque fijo de dos
 * columnas: a la izquierda el paso a paso en texto de verdad, y a la
 * derecha la escena entera reproduciéndose sola, en loop, con CSS.
 *
 * El loop cuenta la historia completa una y otra vez: le llega la
 * invitación al invitado, la acepta con un toque, el aviso viaja hacia
 * el anfitrión y su panel se actualiza en vivo — quién va y quién no,
 * con el contador subiendo. Es el mismo mecanismo (las keyframes
 * `invitacion-*` de globals.css, sincronizadas por `--inv-dur`) que ya
 * corre en /invitaciones, solo que vestido con la paleta navy y dorada
 * de esta página. No hace falta JavaScript para nada de esto — por eso
 * el componente no lleva "use client".
 */

const PASOS = [
  {
    titulo: "Le llega por WhatsApp o correo",
    texto: "Un link, nada que instalar. Se abre a pantalla completa en cualquier teléfono.",
  },
  {
    titulo: "La acepta con un toque",
    texto: "Sin cuentas ni formularios. Dice si va, con cuántos, y lo que vos preguntes.",
  },
  {
    titulo: "El aviso te llega al instante",
    texto: "La confirmación viaja a tu cuenta apenas la tocan, no cuando revisás WhatsApp.",
  },
  {
    titulo: "Tu lista se arma sola",
    texto: "Ves quién va y quién no, con el conteo de personas al día. Ese número le pasás al salón.",
  },
];

export default function Reel({ claseSerif }: { claseSerif: string }) {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto w-[min(1120px,92vw)]">
        <div
          className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16"
          style={{ "--inv-dur": "10s" } as React.CSSProperties}
        >
          {/* ---------- Columna del paso a paso ---------- */}
          <div data-reveal>
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#ee7420]">
              En vivo, ahora mismo
            </p>
            <h2 className="titulo mt-4 max-w-[17ch] text-[clamp(30px,4.6vw,50px)] leading-[1.08] text-white">
              Del link de tu invitado a tu lista de confirmados
            </h2>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-white/55">
              Esto no es un dibujo: es lo que ve tu invitado en su teléfono y lo
              que ves vos en tu cuenta, al mismo tiempo.
            </p>

            <div className="mt-9 flex flex-col gap-6">
              {PASOS.map((p, i) => (
                <div key={p.titulo} className="flex gap-4">
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
                    style={{ background: "#ee7420" }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-[16px] font-extrabold text-white">
                      {p.titulo}
                    </h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/55">
                      {p.texto}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ---------- Columna de la escena animada ---------- */}
          <div
            aria-hidden
            data-reveal
            style={{ "--reveal-delay": "120ms" } as React.CSSProperties}
            className="flex flex-col items-center gap-6"
          >
            <TelefonoInvitado claseSerif={claseSerif} />
            <ConectorViaje />
            {/* Mismo ancho que el panel: así la notificación, centrada con
                inset-x-0 + mx-auto, cae exactamente sobre él. */}
            <div className="relative w-[280px] sm:w-[320px]">
              <NotificacionConfirmacion />
              <PanelAnfitrion />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Un cheque simple, sin depender de los íconos de otra carpeta. */
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

/** El teléfono del invitado: la invitación navy con scroll simulado
 *  hasta "¿Nos acompañás?" y el tap en "Sí, ahí estaré". */
function TelefonoInvitado({ claseSerif }: { claseSerif: string }) {
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

        {/* El contenido que "scrollea" dentro de la pantalla */}
        <div
          className="anim-invitacion-scroll px-5 pb-6 pt-11 text-center text-white"
          style={{ "--inv-scroll": "-186px" } as React.CSSProperties}
        >
          <p
            className="text-[8.5px] font-bold uppercase tracking-[0.3em]"
            style={{ color: "#f0c987" }}
          >
            Nos casamos
          </p>
          <p className={`${claseSerif} mt-3 text-[27px] leading-tight`}>
            Sofía
            <span className="mx-1.5" style={{ color: "#f0c987" }}>
              &amp;
            </span>
            Andrés
          </p>
          <div
            className="mx-auto mt-3 h-px w-12"
            style={{ background: "rgba(240,201,135,.35)" }}
          />
          <p className="mt-3 text-[11px] font-bold text-white/85">
            12 de diciembre · 4:00 p.&nbsp;m.
          </p>
          <p className="mt-1 text-[9.5px] font-semibold text-white/60">
            Hacienda La Chimba, Atenas
          </p>

          {/* La cuenta regresiva, para que el scroll tenga camino */}
          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {[
              ["108", "días"],
              ["06", "horas"],
              ["42", "min"],
            ].map(([n, u]) => (
              <div
                key={u}
                className="rounded-lg py-1.5"
                style={{ background: "rgba(255,255,255,.1)" }}
              >
                <p className="text-[13px] font-extrabold leading-tight tabular-nums">
                  {n}
                </p>
                <p className="text-[7.5px] font-bold uppercase tracking-[0.14em] text-white/60">
                  {u}
                </p>
              </div>
            ))}
          </div>

          {/* La "foto" de la pareja */}
          <div
            className="mt-4 flex h-[110px] items-center justify-center rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg,rgba(240,201,135,0.3) 0%,rgba(59,90,196,0.3) 100%)",
            }}
          >
            <span className={`${claseSerif} text-[22px] italic text-white/90`}>
              S <span style={{ color: "#f0c987" }}>♥</span> A
            </span>
          </div>

          {/* El bloque al que llega el scroll: la confirmación */}
          <div
            className="mt-5 rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,.07)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}
          >
            <p className={`${claseSerif} text-[18px] italic`}>¿Nos acompañás?</p>
            <p className="mt-1 text-[9.5px] font-semibold text-white/70">
              Confirmá antes del 30 de octubre
            </p>

            <div className="relative mt-3">
              <div
                className="anim-invitacion-pulsar rounded-xl py-2.5 text-[12px] font-extrabold"
                style={{ background: "#efe7d8", color: "#14151a" }}
              >
                Sí, ahí estaré
              </div>
              {/* El estado confirmado que cubre al botón tras el tap */}
              <div
                className="anim-invitacion-confirmar absolute inset-0 flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-extrabold text-white"
                style={{ background: "#1f7a4d" }}
              >
                <Check className="h-3.5 w-3.5 shrink-0" /> ¡Confirmado!
              </div>
              {/* El dedo que toca el botón */}
              <span className="anim-invitacion-dedo absolute -bottom-3 right-7 h-9 w-9 rounded-full border-2 border-white/80 bg-white/30 shadow-lg" />
            </div>

            <div className="mt-2 rounded-xl border border-white/25 py-2 text-[11px] font-bold text-white/80">
              No podré ir
            </div>
          </div>

          <p className="mt-4 text-[9px] font-semibold text-white/50">
            Con cariño, Sofía &amp; Andrés
          </p>
        </div>
      </div>
    </div>
  );
}

/** El conector entre aparatos: un puntito (con su caravana) que viaja
 *  del teléfono al panel justo después del tap. Va girado y apunta
 *  hacia abajo porque la escena siempre queda apilada, nunca lado a
 *  lado. */
function ConectorViaje() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-[72px] w-[72px] items-center justify-center">
        <div className="flex rotate-90 items-center gap-1" style={{ color: "#ee7420" }}>
          <div className="relative h-2 w-14">
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current opacity-25" />
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="anim-invitacion-viaje absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-current opacity-0"
                style={
                  {
                    "--inv-delay": `${i * 0.12}s`,
                    "--inv-viaje": "48px",
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
        En menos de un segundo
      </p>
    </div>
  );
}

/** El aviso flotante sobre el panel: lo que el anfitrión recibiría al
 *  confirmar un invitado. Entra en el mismo compás que la fila nueva y
 *  el contador, así los tres se leen como una sola cosa pasando. */
function NotificacionConfirmacion() {
  return (
    <div
      className="anim-invitacion-notificacion absolute -top-5 inset-x-0 z-10 mx-auto w-[224px] rounded-2xl bg-white px-3.5 py-2.5"
      style={{ boxShadow: "0 16px 32px -12px rgba(0,0,0,.45)" }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: "#1f7a4d" }}
        >
          <Check className="h-3 w-3" />
        </span>
        <div className="min-w-0 text-left">
          <p className="truncate text-[10.5px] font-extrabold" style={{ color: "#14151a" }}>
            Nueva confirmación
          </p>
          <p className="truncate text-[10px]" style={{ color: "#6e6e73" }}>
            Ana &amp; Beto · 2 personas
          </p>
        </div>
      </div>
    </div>
  );
}

/** El panel del anfitrión: vidrio esmerilado sobre el navy, con la
 *  lista de invitados y la fila que le entra sola cuando llega el
 *  aviso. El contador se ve subir de 6 a 8 cada vuelta del loop. */
function PanelAnfitrion() {
  return (
    <div
      className="w-[280px] rounded-2xl border border-white/12 p-5 backdrop-blur-xl sm:w-[320px]"
      style={{ background: "rgba(22,41,94,.72)", boxShadow: "0 40px 90px -40px rgba(0,0,0,.85)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
          Tu panel
        </p>
        <span
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "#5fd39a" }}
        >
          <span
            className="anim-invitacion-latir h-[5px] w-[5px] rounded-full"
            style={{ background: "#5fd39a" }}
          />
          En vivo
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5 text-white">
        <span className="titulo relative h-10 w-[1.6ch] overflow-hidden text-[38px] leading-none">
          <span className="anim-invitacion-num-sale absolute inset-0">6</span>
          <span
            className="anim-invitacion-num-entra absolute inset-0"
            style={{ color: "#5fd39a" }}
          >
            8
          </span>
        </span>
        <span className="text-[12.5px] text-white/55">personas confirmadas</span>
      </div>

      <div className="mt-4 space-y-2">
        <FilaConfirmacion iniciales="FJ" nombre="Familia Jiménez" detalle="+4" />
        <FilaConfirmacion iniciales="TR" nombre="Tía Rosa" detalle="+2" />
        <FilaConfirmacion iniciales="CM" nombre="Carlos M." detalle="No va" va={false} />
        <FilaConfirmacion iniciales="AB" nombre="Ana & Beto" detalle="+2" animada />
      </div>
    </div>
  );
}

/** Una fila de la lista de confirmaciones del anfitrión; la `animada`
 *  entra y sale en el mismo compás que el tap del invitado. */
function FilaConfirmacion({
  iniciales,
  nombre,
  detalle,
  va = true,
  animada,
}: {
  iniciales: string;
  nombre: string;
  detalle: string;
  va?: boolean;
  animada?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${animada ? "anim-invitacion-entrar" : ""}`}
      style={{ background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white/80"
        style={{ background: "linear-gradient(140deg,#3a4a7a,#1c2748)" }}
      >
        {iniciales}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">{nombre}</span>
      <span
        className="shrink-0 text-[11px] font-bold"
        style={{ color: va ? "#5fd39a" : "rgba(255,255,255,.35)" }}
      >
        {va ? `${detalle} ✓` : "No va"}
      </span>
    </div>
  );
}
