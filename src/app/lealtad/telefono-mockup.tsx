/**
 * EL TELÉFONO, DIBUJADO.
 *
 * Antes esto montaba el pase sobre una FOTO de un iPhone en una mano.
 * Se veía mal y la razón es estructural, no de ajuste: una foto tiene
 * su propia luz, su propia perspectiva y su propio grano, y el pase
 * —plano, nítido, de frente— nunca termina de pertenecer a esa escena.
 * Se lee como una calcomanía pegada encima.
 *
 * Dibujado, en cambio, todo comparte el mismo lenguaje: el marco, el
 * brillo del vidrio y el pase se iluminan igual porque los ilumina el
 * mismo CSS. Y de yapa pesa 3 KB en vez de 1,4 MB, escala a cualquier
 * tamaño sin pixelarse y se puede animar por dentro.
 *
 * ------------------------------------------------------------------
 * QUÉ LO HACE PARECER UN TELÉFONO Y NO UN RECTÁNGULO
 * ------------------------------------------------------------------
 * Cuatro detalles, y los cuatro importan:
 *
 *   · el marco tiene DOS capas —el canto metálico y el bisel negro—
 *     porque un solo borde se ve como una caja;
 *   · la isla dinámica, que es lo que el ojo reconoce como «iPhone»;
 *   · los botones laterales, que dan el volumen del objeto;
 *   · un reflejo diagonal sobre el vidrio, que es lo único que dice
 *     «esto tiene una superficie brillante».
 */

const NARANJA = "#ee7420";

export default function TelefonoMockup({
  children,
  className = "",
  /** El brillo que recorre el vidrio. Se apaga en listas largas. */
  conBrillo = true,
}: {
  children: React.ReactNode;
  className?: string;
  conBrillo?: boolean;
}) {
  return (
    <div
      className={`flotante relative mx-auto w-[min(268px,72vw)] ${className}`}
    >
      {/* El canto metálico */}
      <div
        className="relative rounded-[44px] p-[3px]"
        style={{
          background:
            "linear-gradient(155deg, #6b7280 0%, #1f2937 22%, #4b5563 48%, #111827 72%, #6b7280 100%)",
          boxShadow:
            "0 30px 60px -20px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.06)",
        }}
      >
        {/* Los botones: silencio y volumen a la izquierda, encendido a
            la derecha. Sobresalen 2px del canto — sin eso el teléfono
            se ve plano de perfil. */}
        <span
          aria-hidden
          className="absolute -left-[2px] top-[92px] h-7 w-[3px] rounded-l"
          style={{ background: "linear-gradient(90deg,#374151,#6b7280)" }}
        />
        <span
          aria-hidden
          className="absolute -left-[2px] top-[130px] h-11 w-[3px] rounded-l"
          style={{ background: "linear-gradient(90deg,#374151,#6b7280)" }}
        />
        <span
          aria-hidden
          className="absolute -right-[2px] top-[118px] h-14 w-[3px] rounded-r"
          style={{ background: "linear-gradient(270deg,#374151,#6b7280)" }}
        />

        {/* El bisel negro */}
        <div className="rounded-[41px] bg-black p-[8px]">
          {/* La pantalla */}
          <div
            className="relative aspect-[9/19.5] overflow-hidden rounded-[34px]"
            style={{ background: "#0a1226" }}
          >
            {/* La isla dinámica. `z-20` para quedar sobre el contenido,
                como en un teléfono de verdad. */}
            <span
              aria-hidden
              className="absolute left-1/2 top-[9px] z-20 h-[19px] w-[64px] -translate-x-1/2 rounded-full bg-black"
            />

            {children}

            {/* El reflejo del vidrio: una banda diagonal que cruza muy
                despacio. Es lo único que convierte la pantalla en una
                superficie — sin esto se ve como un dibujo plano. */}
            {conBrillo && (
              <span
                aria-hidden
                className="brillo-vidrio pointer-events-none absolute inset-0 z-30"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * La pantalla del Wallet con el pase adentro.
 *
 * No es «una tarjeta centrada»: calca la pantalla real —barra de
 * estado, título, el pase, y la línea de ayuda— porque lo que vende no
 * es la tarjeta suelta sino verla ahí, en el teléfono, como la vería
 * un cliente.
 */
export function PantallaWallet({
  negocio,
  colores,
  arriba,
  valor,
  abajo,
  sellos,
  foto,
  detalle,
  movimientos,
}: {
  negocio: string;
  colores: [string, string, string];
  arriba: string;
  valor: string;
  abajo: string;
  /** Para las tarjetas de sellos: [logrados, total]. */
  sellos?: [number, number];
  /** La banda del rubro: el `strip` que Apple pinta de verdad. */
  foto?: string;
  /** El reverso del pase: las reglas de ESTE tipo, en filas. */
  detalle?: { etiqueta: string; valor: string }[];
  /** Las últimas dos entradas del historial. */
  movimientos?: { texto: string; cuando: string }[];
}) {
  return (
    <div className="flex h-full flex-col" style={{ background: "#0a1226" }}>
      {/* Barra de estado */}
      <div className="flex items-center justify-between px-5 pt-[11px] text-white">
        <span className="text-[9px] font-semibold">9:41</span>
        <span className="flex items-center gap-[3px]" aria-hidden>
          {/* Señal: cuatro barras que crecen. */}
          {[3, 5, 7, 9].map((h) => (
            <span
              key={h}
              className="w-[2px] rounded-sm bg-white"
              style={{ height: h }}
            />
          ))}
          <span className="ml-[3px] h-[8px] w-[14px] rounded-[2px] border border-white/70">
            <span className="block h-full w-[70%] rounded-[1px] bg-white" />
          </span>
        </span>
      </div>

      <p className="mt-4 px-5 text-[15px] font-extrabold text-white">Cartera</p>

      {/* El pase */}
      <div className="mt-3 px-3">
        <div
          className="organico overflow-hidden rounded-[16px]"
          style={
            {
              background: colores[0],
              "--c1": colores[0],
              "--c2": colores[1],
              "--c3": colores[2],
              boxShadow: "0 10px 24px -8px rgba(0,0,0,.6)",
            } as React.CSSProperties
          }
        >
          {foto && (
            <div className="relative h-[52px] w-full overflow-hidden">
              {/* Fondo puro CSS: `next/image` acá pediría el optimizador
                  para una banda de 52px que cambia con cada pestaña. */}
              <span
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${foto})`,
                  filter: "saturate(.8) brightness(.5)",
                }}
              />
              <span
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, ${colores[0]}44, ${colores[0]} 100%)`,
                }}
              />
            </div>
          )}

          <div className="px-3 pb-3 pt-2">
            <p className="truncate text-[9px] font-medium text-white/85">
              {negocio}
            </p>

            <p className="mt-2 text-[6.5px] uppercase tracking-[0.18em] text-white/50">
              {arriba}
            </p>
            <p className="text-[19px] font-extrabold leading-none text-white">
              {valor}
            </p>
            <p className="mt-1 text-[7.5px] leading-snug text-white/60">
              {abajo}
            </p>

            {sellos && (
              <div className="mt-2.5 flex flex-wrap gap-[3px]">
                {Array.from({ length: sellos[1] }, (_, i) => (
                  <span
                    key={i}
                    // Cada sello entra escalonado: se ven llenándose de
                    // a uno, que es exactamente lo que hace el programa.
                    className={i < sellos[0] ? "sello-entra" : ""}
                    style={{
                      display: "block",
                      height: 11,
                      width: 11,
                      borderRadius: 999,
                      background: NARANJA,
                      opacity: i < sellos[0] ? 1 : 0.18,
                      animationDelay: `${i * 110}ms`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* El código, sobre blanco: sobre el color de la marca no se
              escanea, y ese es el único trabajo que tiene. */}
          <div className="bg-white px-3 py-2">
            <Codigo semilla={negocio} />
          </div>
        </div>
      </div>

      {/* ── El reverso del pase ────────────────────────────────────
          Debajo del pase quedaban ~200px de navy vacío, y eso hacía
          ver la pantalla como una tarjeta flotando en la nada.

          Lo que va acá no es relleno: es lo que Wallet muestra de
          verdad cuando uno voltea un pase —las reglas—, y son las
          MISMAS que la columna de al lado está explicando. El que
          lee «tope de descuento» lo ve aplicado dos centímetros
          más allá. */}
      {/* `min-h-0 overflow-hidden` es el seguro del alto: la pantalla
          tiene proporción fija de teléfono y no crece. Si un tipo trae
          una fila de más, se recorta ACÁ adentro en vez de empujar la
          línea de abajo fuera del vidrio. */}
      <div className="flex min-h-0 flex-col overflow-hidden">
        {detalle && detalle.length > 0 && (
          <div className="mt-3.5 px-3">
            <p className="px-1 pb-1.5 text-[6.5px] uppercase tracking-[0.16em] text-white/35">
              Detalles del pase
            </p>
            <div
              className="overflow-hidden rounded-[10px]"
              style={{ background: "rgba(255,255,255,.055)" }}
            >
              {detalle.map((d, i) => (
                <div
                  key={d.etiqueta}
                  className="flex items-baseline justify-between gap-2 px-2.5 py-[7px]"
                  style={{
                    borderTop:
                      i === 0 ? undefined : "1px solid rgba(255,255,255,.06)",
                  }}
                >
                  <span className="shrink-0 text-[7.5px] text-white/45">
                    {d.etiqueta}
                  </span>
                  <span className="truncate text-[7.5px] font-bold text-white/85">
                    {d.valor}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Los movimientos ───────────────────────────────────────
          El saldo de arriba no es un número que alguien escribió: es
          la suma de estas líneas. Mostrarlas dice, sin una sola
          palabra de marketing, que hay un historial atrás — que es la
          diferencia entre un programa de lealtad y una libreta. */}
        {movimientos && movimientos.length > 0 && (
          <div className="mt-3 px-3">
            <p className="px-1 pb-1.5 text-[6.5px] uppercase tracking-[0.16em] text-white/35">
              Movimientos
            </p>
            <div className="space-y-[5px]">
              {movimientos.map((m) => (
                <div key={m.texto} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-[5px] w-[5px] shrink-0 rounded-full"
                    style={{ background: NARANJA }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[7.5px] text-white/70">
                    {m.texto}
                  </span>
                  <span className="shrink-0 text-[7px] text-white/35">
                    {m.cuando}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-auto px-5 pb-4 pt-3 text-center text-[7px] leading-snug text-white/35">
        Se actualiza sola en cada visita
      </p>
    </div>
  );
}

/**
 * El código del pase.
 *
 * Era un cuadrado negro macizo, y a 32px un cuadrado negro macizo no
 * se lee como «código»: se lee como una imagen que no cargó. Con los
 * tres ojos de esquina y módulos adentro el ojo lo reconoce al toque,
 * que es todo lo que necesita hacer en un mockup.
 *
 * El patrón sale del nombre del negocio y no de `Math.random()`: así
 * el servidor y el cliente pintan lo mismo —si no, React tira
 * hydration mismatch— y cada tipo tiene su propio dibujo.
 */
function Codigo({ semilla }: { semilla: string }) {
  const LADO = 11;
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) {
    h = Math.imul(h ^ semilla.charCodeAt(i), 16777619) >>> 0;
  }

  const modulos: boolean[] = [];
  for (let i = 0; i < LADO * LADO; i++) {
    const f = Math.floor(i / LADO);
    const c = i % LADO;
    // Los tres ojos: 3x3 macizos con su marco, como un QR de verdad.
    const enOjo =
      (f < 3 && c < 3) || (f < 3 && c >= LADO - 3) || (f >= LADO - 3 && c < 3);
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    modulos.push(enOjo || (h >>> 16) % 100 < 46);
  }

  return (
    <div
      aria-hidden
      className="mx-auto grid"
      style={{ gridTemplateColumns: `repeat(${LADO}, 3px)`, gap: 0 }}
    >
      {modulos.map((lleno, i) => (
        <span
          key={i}
          style={{
            height: 3,
            width: 3,
            background: lleno ? "#0a1226" : "transparent",
          }}
        />
      ))}
    </div>
  );
}
