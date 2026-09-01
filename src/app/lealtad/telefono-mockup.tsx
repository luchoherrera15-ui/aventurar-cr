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

import type { TernaColor } from "@/lib/lealtad/paletas";

/* La pantalla es navy: los sellos LOGRADOS se quedan naranja —es lo que
   el cliente ganó, y el color distingue lleno de vacío—, y el puntito de
   cada movimiento, que no marca ningún logro, pasa al azul de acción de
   fondo oscuro. */
const ACENTO = "var(--orange)";
const ACCION = "var(--accion-claro)";

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
    // `flotante` es el vaivén lento; el resto del chasis vive en
    // `MarcoIPhone` para que los mockups de la landing usen el mismo.
    //
    // El `100%` del min NO es decorativo: el `72vw` mide contra la
    // VENTANA y no sabe del padding que tenga arriba. Dentro del panel
    // del acordeón —que en 320px deja 232px de caja— el teléfono pedía
    // 230,4: entraba por 1,6px. Con `100%` se rinde al contenedor
    // cuando este es el más chico.
    <MarcoIPhone className={`flotante ${className}`} conBrillo={conBrillo}>
      {children}
    </MarcoIPhone>
  );
}

/**
 * EL CHASIS. Uno solo para todo Lealtad.
 *
 * Lo que lo hace leerse como un iPhone y no como un rectángulo son
 * cinco cosas, y las cinco viven acá para que ninguna pantalla se
 * olvide de alguna:
 *
 *   · el canto de titanio con sus nueve bandas frías —un borde de un
 *     solo tono se ve pintado, no metálico—;
 *   · el bisel negro de 6 px entre el canto y el vidrio;
 *   · la proporción 9/19,5, que es lo primero que delata a un mockup
 *     cuando está mal: la silueta se lee antes que cualquier detalle;
 *   · la isla dinámica con el punto de la cámara;
 *   · el reflejo diagonal, que convierte la pantalla en superficie.
 *
 * ⚠️ NO DIBUJES OTRO MARCO. Antes de esto había siete: este y los seis
 *    de los mockups de la landing, cada uno con su degradado, su radio
 *    y su isla. Si necesitás otro tamaño, pasá `ancho`; si necesitás
 *    otro fondo de pantalla, pasá `fondoPantalla`.
 */
export function MarcoIPhone({
  children,
  className = "",
  /** La clase de ancho. El alto sale solo de la proporción. */
  ancho = "w-[min(268px,72vw,100%)]",
  /** El color de la pantalla apagada, detrás del contenido. */
  fondoPantalla = "#0a1226",
  conBrillo = true,
}: {
  children: React.ReactNode;
  className?: string;
  ancho?: string;
  fondoPantalla?: string;
  conBrillo?: boolean;
}) {
  return (
    <div className={`relative mx-auto ${ancho} ${className}`}>
      {/* El canto de titanio — más bandas que antes y más frías (el
          gris azulado del titanio de verdad, no el gris cálido de un
          aluminio genérico), para que el brillo lea como metal
          cepillado y no como un borde pintado de un solo tono. */}
      <div
        className="relative rounded-[46px] p-[3px]"
        style={{
          background:
            "linear-gradient(152deg, #e4e4e7 0%, #9a9ca3 10%, #5b5d63 24%, #2a2b2f 40%, #1c1d20 52%, #37383d 64%, #121316 78%, #86878d 90%, #e4e4e7 100%)",
          boxShadow:
            "0 30px 60px -20px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.08)",
        }}
      >
        {/* Los botones: silencio y volumen a la izquierda, encendido a
            la derecha. Sobresalen 2px del canto — sin eso el teléfono
            se ve plano de perfil. */}
        <span
          aria-hidden
          className="absolute -left-[2px] top-[92px] h-7 w-[3px] rounded-l"
          style={{ background: "linear-gradient(90deg,#374151,#9a9ca3)" }}
        />
        <span
          aria-hidden
          className="absolute -left-[2px] top-[130px] h-11 w-[3px] rounded-l"
          style={{ background: "linear-gradient(90deg,#374151,#9a9ca3)" }}
        />
        <span
          aria-hidden
          className="absolute -right-[2px] top-[118px] h-14 w-[3px] rounded-r"
          style={{ background: "linear-gradient(270deg,#374151,#9a9ca3)" }}
        />

        {/* El bisel: más fino que antes (6px, no 8px) — los iPhone
            recientes casi no tienen marco negro visible, y un bisel
            grueso es lo que más traiciona a un mockup de "teléfono
            genérico". El anillo de 1px por dentro simula el filo donde
            el vidrio se encuentra con el metal. */}
        <div
          className="rounded-[43px] bg-black p-[6px]"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05)" }}
        >
          {/* La pantalla */}
          <div
            className="relative aspect-[9/19.5] overflow-hidden rounded-[36px]"
            style={{
              background: fondoPantalla,
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04)",
            }}
          >
            {/* La isla dinámica: más ancha que antes (proporción real
                de iPhone) y con el puntito de la cámara frontal —el
                detalle que más rápido dice "esto es un iPhone", no un
                teléfono genérico con una muesca negra. `z-20` para
                quedar sobre el contenido, como en un teléfono de
                verdad. */}
            <span
              aria-hidden
              className="absolute left-1/2 top-[10px] z-20 flex h-[22px] w-[76px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-[6px]"
            >
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{
                  background: "radial-gradient(circle at 35% 35%, #3a4a6b, #0a0e1a 70%)",
                }}
              />
            </span>

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
  /** La terna de `src/lib/lealtad/paletas.ts`: fondo, medio, acento. */
  colores: TernaColor;
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
        <span className="flex items-center gap-[4px]" aria-hidden>
          {/* Señal: cuatro barras que crecen. */}
          <span className="flex items-end gap-[1.5px]">
            {[3, 5, 7, 9].map((h) => (
              <span
                key={h}
                className="w-[2px] rounded-sm bg-white"
                style={{ height: h }}
              />
            ))}
          </span>
          {/* Wifi: los mismos tres arcos que dibuja iOS, no un ícono
              genérico — es una de las señales más rápidas de "esto es
              un iPhone" en la barra de estado. */}
          <svg
            viewBox="0 0 16 12"
            className="h-[9px] w-[12px]"
            fill="none"
            stroke="white"
            strokeWidth="1.4"
            strokeLinecap="round"
          >
            <path d="M1.5 4.8a10 10 0 0 1 13 0" />
            <path d="M4 7.4a6 6 0 0 1 8 0" />
            <path d="M6.7 10a2.4 2.4 0 0 1 2.6 0" />
          </svg>
          <span className="ml-[1px] h-[8px] w-[14px] rounded-[2px] border border-white/70">
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
                      background: ACENTO,
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
            {/* `texto` solo NO alcanza de key: FICHAS.sellos repite
                "Sello agregado" en sus dos movimientos, y dos hijos con
                la misma key rompen la identidad de React. */}
            <div className="space-y-[5px]">
              {movimientos.map((m) => (
                <div key={`${m.texto}-${m.cuando}`} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-[5px] w-[5px] shrink-0 rounded-full"
                    style={{ background: ACCION }}
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
