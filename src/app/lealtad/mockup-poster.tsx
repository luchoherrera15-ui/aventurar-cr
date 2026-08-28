import "./mockup-poster.css";

/**
 * EL iPAD QUE ENTRA A «PÓSTER Y QR» — para el tutorial (28 ago 2026).
 *
 * Pedido del dueño, literal: «se ve un iPad con ese dashboard,
 * abriendo la categoría de Póster y QR, que se vea como entrando ahí y
 * luego mostrando el póster». El menú lateral es el del panel real
 * (los mismos renglones de secciones-lealtad), el renglón de Póster y
 * QR se enciende con un anillo de clic, y el contenido funde del
 * tablero al póster con su QR — el reloj vive en mockup-poster.css.
 *
 * El QR es de UTILERÍA (un dibujo, no un código que lleve a algún
 * lado): este mockup enseña el RECORRIDO, no un negocio. El póster
 * real con el QR real vive en /lealtad/panel/[id]/poster.
 *
 * Server component sin estado, como toda la familia mockup-*.
 */

/** Los renglones del menú, en el orden del panel real. */
const MENU = [
  "Inicio",
  "Dashboard",
  "Tarjetas",
  "Clientes",
  "Métricas",
  "Marketing",
  "Póster y QR",
  "Plan",
];

/** Un QR de utilería: tres esquinas de posición y módulos sueltos. */
function QrUtileria() {
  return (
    <svg viewBox="0 0 29 29" className="h-full w-full" aria-hidden>
      {/* Las tres esquinas de posición. */}
      {[
        [0, 0],
        [22, 0],
        [0, 22],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="7" height="7" fill="#101828" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="#ffffff" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="#101828" />
        </g>
      ))}
      {/* Módulos sueltos, deterministas: dibujo, no dato. */}
      {[
        [9, 1], [11, 2], [13, 0], [15, 3], [17, 1], [19, 2],
        [9, 5], [12, 6], [16, 5], [18, 6],
        [1, 9], [3, 11], [5, 10], [2, 14], [6, 13], [4, 16], [1, 18], [5, 19],
        [9, 9], [11, 10], [13, 12], [15, 9], [17, 11], [19, 13], [21, 10],
        [23, 12], [25, 9], [27, 11], [24, 15], [26, 17],
        [10, 15], [12, 17], [14, 14], [16, 16], [18, 18], [20, 15],
        [9, 21], [11, 23], [13, 25], [15, 22], [17, 24], [19, 26],
        [21, 21], [23, 23], [25, 25], [27, 22], [22, 27], [26, 20],
      ].map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width="1.6" height="1.6" fill="#101828" />
      ))}
    </svg>
  );
}

export default function MockupPoster() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[460px]">
      {/* El marco del iPad. */}
      <div className="overflow-hidden rounded-[22px] border-[8px] border-[#0a1226] bg-white shadow-[0_36px_80px_-36px_rgba(10,18,38,0.5)]">
        <div className="flex">
          {/* El menú lateral, en navy como el panel de verdad. */}
          <div className="w-[34%] shrink-0 bg-[#101a33] px-2 py-3">
            <div className="mb-3 flex items-center gap-1.5 px-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[8px] font-extrabold text-white">
                TN
              </span>
              <span className="truncate text-[9px] font-extrabold text-white">Tu negocio</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {MENU.map((item) =>
                item === "Póster y QR" ? (
                  <div
                    key={item}
                    className="mp-item-activo relative rounded-md px-1.5 py-1 text-[8.5px] font-extrabold text-white"
                  >
                    {item}
                    {/* El anillo del clic, centrado sobre el renglón. */}
                    <span className="mp-clic absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                ) : (
                  <div
                    key={item}
                    className="rounded-md px-1.5 py-1 text-[8.5px] font-bold text-white/55"
                  >
                    {item}
                  </div>
                ),
              )}
            </div>
          </div>

          {/* El contenido: tablero → póster, fundido por el reloj. */}
          <div className="min-w-0 flex-1 bg-[#f5f7fc] p-3">
            <div className="mp-pila h-full">
              {/* 1 · El tablero de siempre. */}
              <div className="mp-tablero">
                <p className="mb-2 text-[10px] font-extrabold text-aventurea-ink">Dashboard</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    ["Sellos hoy", "12"],
                    ["Clientes", "48"],
                    ["Premios", "3"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-white p-1.5 shadow-sm">
                      <p className="text-[6.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">{k}</p>
                      <p className="text-[13px] font-extrabold tabular-nums text-[#101a33]">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 rounded-lg bg-white p-2 shadow-sm">
                  <p className="mb-1.5 text-[6.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Sellos por día
                  </p>
                  <div className="flex items-end gap-1">
                    {[40, 65, 30, 80, 100, 70, 25].map((alto, i) => (
                      <div
                        key={i}
                        className="min-w-0 flex-1 rounded-t-sm"
                        style={{ height: `${alto * 0.4}px`, background: i === 4 ? "#101a33" : "#dbe3f2" }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* 2 · El póster, como sale de «Póster y QR». */}
              <div className="mp-poster">
                <div className="mx-auto flex h-full max-w-[190px] flex-col items-center rounded-lg bg-white px-3 py-3 text-center shadow-[0_10px_30px_-14px_rgba(16,24,40,0.35)]">
                  <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-aventurea-ink-soft">
                    Tu negocio
                  </p>
                  <p className="mt-1 text-[12.5px] font-extrabold leading-tight text-[#101a33]">
                    Sumá sellos
                    <br />
                    con tu teléfono
                  </p>
                  <div className="my-2 h-[88px] w-[88px]">
                    <QrUtileria />
                  </div>
                  <p className="text-[7px] font-bold text-aventurea-ink-soft">Escaneá y llevate tu tarjeta</p>
                  <p className="mt-1.5 text-[6.5px] font-extrabold uppercase tracking-[0.14em] text-[#3aa981]">
                    A los 5 sellos
                  </p>
                  <p className="text-[9px] font-extrabold text-[#101a33]">Producto gratis</p>
                  <p className="mt-auto pt-1.5 text-[6px] font-bold text-aventurea-ink-soft">
                    Apple Wallet · Google Wallet — sin apps que instalar
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
