import "./escena-descuentos.css";

/**
 * La escena "Descuentos y puntos": un cliente paga en el negocio, toca
 * "Usar mis puntos" y el total baja al instante — mientras, al dueño le
 * entra el aviso y su panel se actualiza solo. Igual que el Reel de
 * /invitaciones: dos piezas apiladas (teléfono + panel), una sola
 * duración compartida por CSS (`--desc-dur`, definida acá con un
 * default de 8s) sincroniza todo por porcentajes, y no hace falta
 * JavaScript para nada de esto — por eso el componente no lleva
 * "use client". Autónomo: quien lo importe no necesita pasarle props.
 */
export default function EscenaDescuentos() {
  return (
    <div
      aria-hidden
      style={{ "--desc-dur": "8s" } as React.CSSProperties}
      className="flex flex-col items-center gap-6"
    >
      <TicketDescuento />
      <ConectorDescuento />
      {/* Mismo ancho que el panel: así la notificación, centrada con
          inset-x-0 + mx-auto, cae exactamente sobre él. */}
      <div className="relative w-[280px] sm:w-[320px]">
        <NotificacionDescuento />
        <PanelDescuentos />
      </div>
    </div>
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

/** El teléfono del cliente: la cuenta de un negocio de ejemplo, con el
 *  botón "Usar mis puntos" y el total que reacciona tras el tap. */
function TicketDescuento() {
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

        <div className="px-5 pb-6 pt-11 text-white">
          {/* Encabezado del negocio */}
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
              style={{ background: "linear-gradient(140deg,#ee7420,#b6540f)" }}
            >
              P
            </span>
            <div className="min-w-0 text-left">
              <p className="truncate text-[11.5px] font-extrabold text-white">
                PuraMatcha Bar
              </p>
              <p className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/45">
                Cuenta #482
              </p>
            </div>
          </div>

          {/* Badge de puntos disponibles */}
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{ background: "rgba(238,116,32,.16)" }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: "#ee7420" }}
            />
            <span className="text-[9.5px] font-bold text-[#ee7420]">
              320 puntos disponibles
            </span>
          </div>

          {/* Los ítems de la cuenta */}
          <div className="mt-4 space-y-2 text-left">
            {[
              ["Matcha latte grande", "₡2 500"],
              ["Bowl de açaí", "₡4 500"],
              ["Muffin de banano", "₡1 500"],
            ].map(([item, precio]) => (
              <div
                key={item}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-white/60">{item}</span>
                <span className="font-semibold text-white/85">{precio}</span>
              </div>
            ))}
          </div>

          <div
            className="my-3 h-px w-full"
            style={{ background: "rgba(255,255,255,.1)" }}
          />

          <div className="flex items-center justify-between text-[10.5px] text-white/45">
            <span>Subtotal</span>
            <span>₡8 500</span>
          </div>

          {/* El botón, su tap y el estado confirmado que lo cubre */}
          <div className="relative mt-4">
            <div
              className="anim-desc-pulsar rounded-xl py-2.5 text-center text-[12px] font-extrabold"
              style={{ background: "#efe7d8", color: "#14151a" }}
            >
              Usar mis puntos
            </div>
            <div
              className="anim-desc-confirmar absolute inset-0 flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-extrabold text-white"
              style={{ background: "#1f7a4d" }}
            >
              <Check className="h-3.5 w-3.5 shrink-0" /> ¡Descuento aplicado!
            </div>
            {/* El dedo que toca el botón */}
            <span className="anim-desc-dedo absolute -bottom-3 right-7 h-9 w-9 rounded-full border-2 border-white/80 bg-white/30 shadow-lg" />
          </div>

          {/* El total: precio original, y el que lo reemplaza tras el tap */}
          <div className="relative mt-5 h-[22px]">
            <span
              className="anim-desc-pop absolute -top-4 right-0 rounded-full px-2.5 py-1 text-[9px] font-extrabold text-white"
              style={{ background: "#1f7a4d" }}
            >
              -₡1 500 en puntos
            </span>

            <div className="absolute inset-0 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                Total
              </span>
              <span className="text-[19px] font-extrabold text-white">
                ₡8 500
              </span>
            </div>

            <div
              className="anim-desc-descuento absolute inset-0 flex items-center justify-between"
              style={{ background: "#0a1226" }}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                Total
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-[11.5px] font-semibold text-white/35 line-through">
                  ₡8 500
                </span>
                <span
                  className="text-[19px] font-extrabold"
                  style={{ color: "#5fd39a" }}
                >
                  ₡7 000
                </span>
              </span>
            </div>
          </div>

          <p className="mt-4 text-[9px] font-semibold text-white/40">
            Los puntos se descuentan al instante, sin pedirlos en caja.
          </p>
        </div>
      </div>
    </div>
  );
}

/** El conector entre aparatos: un puntito que viaja del teléfono al
 *  panel justo después del tap. Va girado hacia abajo porque la escena
 *  siempre queda apilada, nunca lado a lado. */
function ConectorDescuento() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-[72px] w-[72px] items-center justify-center">
        <div className="flex rotate-90 items-center gap-1" style={{ color: "#ee7420" }}>
          <div className="relative h-2 w-14">
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current opacity-25" />
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="anim-desc-viaje absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-current opacity-0"
                style={
                  {
                    "--desc-delay": `${i * 0.12}s`,
                    "--desc-viaje": "48px",
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
        Al instante, sin canjear en caja
      </p>
    </div>
  );
}

/** El aviso flotante sobre el panel: lo que ve el dueño apenas el
 *  cliente usa sus puntos. Entra en el mismo compás que la fila nueva y
 *  el contador, así los tres se leen como una sola cosa pasando. */
function NotificacionDescuento() {
  return (
    <div
      className="anim-desc-notificacion absolute -top-5 inset-x-0 z-10 mx-auto w-[224px] rounded-2xl bg-white px-3.5 py-2.5"
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
            Descuento aplicado
          </p>
          <p className="truncate text-[10px]" style={{ color: "#6e6e73" }}>
            Sofía N. · -₡1 500 en puntos
          </p>
        </div>
      </div>
    </div>
  );
}

/** El panel del negocio: vidrio esmerilado sobre el navy, con el
 *  contador del día y la fila que le entra sola cuando llega el aviso.
 *  El contador se ve subir de 18 a 19 cada vuelta del loop. */
function PanelDescuentos() {
  return (
    <div
      className="w-[280px] rounded-2xl border border-white/12 p-5 backdrop-blur-xl sm:w-[320px]"
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
            className="anim-desc-latir h-[5px] w-[5px] rounded-full"
            style={{ background: "#5fd39a" }}
          />
          En vivo
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5 text-white">
        <span className="titulo relative h-10 w-[2.1ch] overflow-hidden text-[38px] leading-none">
          <span className="anim-desc-num-sale absolute inset-0">18</span>
          <span
            className="anim-desc-num-entra absolute inset-0"
            style={{ color: "#5fd39a" }}
          >
            19
          </span>
        </span>
        <span className="text-[12.5px] text-white/55">clientes con descuento hoy</span>
      </div>

      <div className="mt-4 space-y-2">
        <FilaDescuento iniciales="MJ" nombre="María J." monto="-₡800" />
        <FilaDescuento iniciales="RC" nombre="Randall C." monto="-₡1 200" />
        <FilaDescuento iniciales="SN" nombre="Sofía N." monto="-₡1 500" animada />
      </div>
    </div>
  );
}

/** Una fila de la lista de descuentos del panel; la `animada` entra y
 *  sale en el mismo compás que el tap del cliente. */
function FilaDescuento({
  iniciales,
  nombre,
  monto,
  animada,
}: {
  iniciales: string;
  nombre: string;
  monto: string;
  animada?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${animada ? "anim-desc-entrar" : ""}`}
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
        {monto} ✓
      </span>
    </div>
  );
}
