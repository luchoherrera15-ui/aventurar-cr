"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

/**
 * Las piezas animadas de la plantilla clásica de /i/{slug}: el sobre
 * de apertura, el carrito de recién casados, la cuenta regresiva, el
 * ambiente de pétalos y el confetti del RSVP. Todo vive acá para no
 * engordar invitacion-vista; los keyframes (inv2-*) están en
 * plantillas.css. Nada de esto toca el camino de html_personalizado.
 *
 * NINGUNA de estas piezas consulta prefers-reduced-motion: por decisión
 * del dueño el producto de invitaciones se anima igual para todo el
 * mundo (el sobre, los pétalos, el carrito y el confetti corren
 * siempre). El hook @/lib/use-movimiento-reducido sigue existiendo y
 * sigue mandando en el RESTO del sitio —el riel de /invitaciones, los
 * modales del panel, la agenda—; simplemente acá no se usa.
 */

/** "Sofía & Andrés" → "S&A" para el sello de cera. */
export function inicialesDe(titulo: string): string {
  const partes = titulo
    .split(/\s*(?:&|\by\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length >= 2) {
    const palabrasA = partes[0].split(/\s+/).filter(Boolean);
    const palabrasB = partes[1].split(/\s+/).filter(Boolean);
    const a = palabrasA[palabrasA.length - 1]?.[0];
    const b = palabrasB[0]?.[0];
    if (a && b) return `${a.toUpperCase()}&${b.toUpperCase()}`;
  }
  return titulo.trim()[0]?.toUpperCase() ?? "✦";
}

/* ------------------------------------------------------------------ */
/* 1. La apertura tipo sobre                                           */
/* ------------------------------------------------------------------ */

/**
 * El sobre cerrado que cubre la invitación al llegar: papel crema con
 * sello de cera dorado champán y "Tocá para abrir". Un toque en
 * cualquier lado dispara la apertura (la solapa rota con perspective y
 * la carta emerge); un segundo toque la salta. Se muestra siempre: el
 * sobre ES la invitación, y quien llega con movimiento reducido también
 * tiene que verlo (antes el CSS lo escondía y se perdía la apertura).
 */
export function SobreApertura({
  iniciales,
  titulo,
  abriendo,
  onTocar,
}: {
  iniciales: string;
  titulo: string;
  abriendo: boolean;
  onTocar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTocar}
      aria-label="Abrir la invitación"
      className={`inv2-sobre-overlay fixed inset-0 z-[60] flex cursor-pointer select-none flex-col items-center justify-center gap-10 bg-[#f2ecdf] px-6 text-[#3d3a35] touch-manipulation ${
        abriendo ? "inv2-anim-sobre-fade" : ""
      }`}
    >
      {/* El mismo aire del lienzo: dos veladuras champán sobre crema. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(46rem 30rem at 80% -10%, rgba(201,169,106,0.22), transparent 60%)," +
            "radial-gradient(40rem 28rem at -10% 70%, rgba(176,141,87,0.16), transparent 60%)",
        }}
      />

      <span
        className="relative block w-[min(330px,84vw)]"
        style={{ perspective: "1100px" }}
      >
        <span className="relative block aspect-[10/7]">
          {/* Fondo del sobre: papel crema profundo. */}
          <span className="absolute inset-0 rounded-2xl bg-[#e9dfca] shadow-[0_30px_70px_-28px_rgba(107,88,53,0.55)]" />

          {/* La carta adentro: marfil con filo dorado, emerge al abrir. */}
          <span
            className={`absolute inset-x-[8%] bottom-[8%] top-[12%] flex flex-col items-center justify-center rounded-xl border border-[#e6dcc4] bg-[#fffdf8] px-4 text-center shadow-[0_10px_30px_rgba(107,88,53,0.28)] ${
              abriendo ? "inv2-anim-carta-sale" : ""
            }`}
          >
            <span aria-hidden className="block text-[12px] tracking-[0.4em] text-[#b08d57]">
              ✦ ✦ ✦
            </span>
            <span className="inv3-serif mt-2 block max-w-[16ch] text-[clamp(20px,5.6vw,26px)] leading-snug text-[#3d3a35]">
              {titulo}
            </span>
            <span className="mt-2 block text-[10.5px] font-semibold uppercase tracking-[0.24em] text-[#8a8378]">
              Tenés una invitación
            </span>
          </span>

          {/* Frente del sobre (el bolsillo en V que guarda la carta). */}
          <span
            className="absolute inset-0 rounded-2xl bg-[#efe6d1] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
            style={{ clipPath: "polygon(0 0, 50% 48%, 100% 0, 100% 100%, 0 100%)" }}
          />

          {/* La solapa: rota hacia atrás con perspective al abrir. */}
          <span
            className={`absolute inset-x-0 top-0 block h-[52%] ${abriendo ? "inv2-anim-solapa" : ""}`}
            style={{
              transformOrigin: "center top",
              backfaceVisibility: "hidden",
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            }}
          >
            <span className="absolute inset-0 rounded-t-2xl bg-[#f4eddd] shadow-[inset_0_-14px_24px_rgba(160,133,84,0.22)]" />
          </span>

          {/* El sello de cera dorado champán con las iniciales, en la
              punta de la solapa — viaja con ella al abrirse. */}
          <span
            className={`absolute left-1/2 top-[52%] flex h-16 w-16 items-center justify-center rounded-full text-[15px] font-bold tracking-wide text-[#fdf9f0] ${
              abriendo ? "" : "inv2-anim-sello"
            }`}
            style={{
              transform: "translate(-50%, -50%)",
              background: "radial-gradient(circle at 35% 30%, #cfae74, #9a7847 72%)",
              boxShadow: "0 6px 18px rgba(107,88,53,0.4), inset 0 2px 6px rgba(255,255,255,0.35)",
              opacity: abriendo ? 0 : 1,
              transition: "opacity 0.3s ease-out",
            }}
          >
            {iniciales}
            <span aria-hidden className="absolute inset-1 rounded-full border border-[#fdf9f0]/50" />
          </span>
        </span>
      </span>

      <span className="inv2-anim-pulso relative block text-[13px] font-semibold uppercase tracking-[0.22em] text-[#8a8378]">
        Tocá para abrir la invitación
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 2. El carrito de recién casados                                     */
/* ------------------------------------------------------------------ */

/** Ancho al que se renderiza el SVG del carro (px). */
const ANCHO_CARRO = 168;
/** Radio de las ruedas ya renderizadas: 19 unidades × (168/260). */
const RADIO_RUEDA_PX = 19 * (ANCHO_CARRO / 260);

/**
 * El carro clásico con rótulo "Recién casados" y latas rebotando.
 * Avanza por el caminito según el progreso de scroll de TODA la
 * página (rAF, solo transform) y las ruedas giran lo que corresponde
 * al recorrido. Al tocarlo: saltito, tres corazones por el escape y
 * un globito "¡beep beep!". Viaja siempre, sin mirar la señal de
 * movimiento reducido.
 */
export function CarritoNovios() {
  const franjaRef = useRef<HTMLDivElement | null>(null);
  const carroRef = useRef<HTMLButtonElement | null>(null);
  const brincoRef = useRef<HTMLSpanElement | null>(null);
  const ruedaTraseraRef = useRef<SVGGElement | null>(null);
  const ruedaDelanteraRef = useRef<SVGGElement | null>(null);
  const [beep, setBeep] = useState(false);
  const [tanda, setTanda] = useState(0);
  const timeoutsRef = useRef<number[]>([]);

  // El viaje: progreso de scroll de la página → posición en la franja.
  useEffect(() => {
    let frame = 0;
    const pintar = () => {
      frame = 0;
      const franja = franjaRef.current;
      const carro = carroRef.current;
      if (!franja || !carro) return;
      const maximo = document.documentElement.scrollHeight - window.innerHeight;
      const progreso = maximo > 0 ? Math.min(1, Math.max(0, window.scrollY / maximo)) : 0;
      const recorrido = Math.max(0, franja.clientWidth - ANCHO_CARRO);
      const x = progreso * recorrido;
      carro.style.transform = `translate3d(${x}px, 0, 0)`;
      // Las ruedas giran lo que rodaron: ángulo = distancia / radio.
      const giro = `rotate(${(x / RADIO_RUEDA_PX) * (180 / Math.PI)}deg)`;
      if (ruedaTraseraRef.current) ruedaTraseraRef.current.style.transform = giro;
      if (ruedaDelanteraRef.current) ruedaDelanteraRef.current.style.transform = giro;
    };
    const alMover = () => {
      if (!frame) frame = window.requestAnimationFrame(pintar);
    };
    pintar();
    window.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
    };
  }, []);

  useEffect(() => {
    const pendientes = timeoutsRef.current;
    return () => pendientes.forEach((t) => window.clearTimeout(t));
  }, []);

  function tocarCarro() {
    setBeep(true);
    timeoutsRef.current.push(window.setTimeout(() => setBeep(false), 1000));
    // El saltito se redispara quitando y volviendo a poner la clase.
    const brinco = brincoRef.current;
    if (brinco) {
      brinco.classList.remove("inv2-anim-salto");
      void brinco.offsetWidth;
      brinco.classList.add("inv2-anim-salto");
    }
    setTanda((t) => t + 1);
    timeoutsRef.current.push(window.setTimeout(() => setTanda(0), 1400));
  }

  const coloresCorazon = ["#b08d57", "#c9a96a", "#8a6a3f"];

  return (
    <div data-reveal className="w-full">
      <p className="px-6 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8a8378]">
        Y que arranque el viaje
      </p>

      <div ref={franjaRef} className="relative mt-4 h-[118px]">
        {/* El caminito punteado, en línea fina dorada. */}
        <div aria-hidden className="absolute inset-x-0 bottom-[8px] border-t border-dashed border-[#b08d57]/45" />

        <button
          type="button"
          ref={carroRef}
          onClick={tocarCarro}
          aria-label="Tocá el carrito de los recién casados"
          className="absolute bottom-0 left-0 block w-[168px] cursor-pointer select-none touch-manipulation will-change-transform"
        >
          {beep && (
            <span
              className="inv2-anim-beep absolute -top-6 left-1/2 block whitespace-nowrap rounded-full border border-[#c9a96a] bg-white px-3 py-1 text-[12px] font-bold text-[#3d3a35] shadow-md"
              style={{ transform: "translateX(-50%)" }}
            >
              ¡beep beep!
            </span>
          )}

          {tanda > 0 &&
            [0, 1, 2].map((i) => (
              <span
                key={`${tanda}-${i}`}
                aria-hidden
                className="inv2-anim-corazon absolute bottom-[24px] left-[8px] block text-[15px] leading-none"
                style={
                  {
                    color: coloresCorazon[i],
                    animationDelay: `${i * 130}ms`,
                    "--inv2-dx": `${(i - 1) * 16 - 8}px`,
                  } as CSSProperties
                }
              >
                ♥
              </span>
            ))}

          {/* El saltito anima este span para no pelear con el
              translateX del scroll (que vive en el botón). */}
          <span ref={brincoRef} className="block">
            <svg viewBox="0 0 260 150" className="block h-auto w-full" aria-hidden>
              {/* Rótulo "Recién casados" colgado atrás. */}
              <g transform="rotate(-8 34 84)">
                <line x1="62" y1="76" x2="70" y2="90" stroke="rgba(138,106,63,0.55)" strokeWidth="1.5" />
                <rect x="4" y="68" width="60" height="32" rx="7" fill="#fffdf8" stroke="#b08d57" strokeWidth="1.5" />
                <text x="34" y="82" textAnchor="middle" fontSize="11" fontWeight="600" fill="#6b5636">
                  Recién
                </text>
                <text x="34" y="94" textAnchor="middle" fontSize="11" fontWeight="600" fill="#6b5636">
                  casados
                </text>
              </g>

              {/* Las 3 latas arrastradas, cada una con su rebote. */}
              <g className="inv2-anim-lata" style={{ "--inv2-dur": "0.5s", "--inv2-delay": "0s" } as CSSProperties}>
                <line x1="62" y1="112" x2="14" y2="129" stroke="rgba(138,106,63,0.5)" strokeWidth="1.25" />
                <rect x="6" y="125" width="14" height="9" rx="2" transform="rotate(-14 13 129)" fill="#fffdf8" stroke="#8a6a3f" strokeWidth="1" />
              </g>
              <g className="inv2-anim-lata" style={{ "--inv2-dur": "0.62s", "--inv2-delay": "0.12s" } as CSSProperties}>
                <line x1="62" y1="113" x2="30" y2="134" stroke="rgba(138,106,63,0.5)" strokeWidth="1.25" />
                <rect x="23" y="130" width="14" height="9" rx="2" transform="rotate(10 30 134)" fill="#fffdf8" stroke="#8a6a3f" strokeWidth="1" />
              </g>
              <g className="inv2-anim-lata" style={{ "--inv2-dur": "0.55s", "--inv2-delay": "0.22s" } as CSSProperties}>
                <line x1="62" y1="114" x2="46" y2="131" stroke="rgba(138,106,63,0.5)" strokeWidth="1.25" />
                <rect x="39" y="127" width="14" height="9" rx="2" transform="rotate(-8 46 131)" fill="#fffdf8" stroke="#8a6a3f" strokeWidth="1" />
              </g>

              {/* Escape. */}
              <rect x="44" y="104" width="14" height="6" rx="3" fill="rgba(138,106,63,0.35)" />

              {/* Carrocería en trazo fino dorado. */}
              <path
                d="M64 116 L64 100 Q64 88 76 88 L108 88 L122 60 Q126 52 134 52 L182 52 Q190 52 196 60 L210 88 L228 88 Q240 88 240 100 L240 112 Q240 118 234 118 L70 118 Q64 118 64 116 Z"
                fill="rgba(201,169,106,0.1)"
                stroke="#b08d57"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* Ventanas. */}
              <rect x="131" y="60" width="23" height="24" rx="4" fill="rgba(201,169,106,0.16)" stroke="#b08d57" strokeWidth="1.75" />
              <rect x="160" y="60" width="26" height="24" rx="4" fill="rgba(201,169,106,0.16)" stroke="#b08d57" strokeWidth="1.75" />
              {/* Manija, foco y parachoques. */}
              <line x1="148" y1="96" x2="158" y2="96" stroke="rgba(138,106,63,0.7)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="234" cy="96" r="4" fill="#c9a96a" />
              <line x1="240" y1="112" x2="250" y2="112" stroke="rgba(138,106,63,0.75)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="48" y1="112" x2="64" y2="112" stroke="rgba(138,106,63,0.75)" strokeWidth="2.5" strokeLinecap="round" />
              {/* Antena con corazón. */}
              <line x1="216" y1="88" x2="216" y2="72" stroke="rgba(138,106,63,0.55)" strokeWidth="1.5" />
              <text x="216" y="70" textAnchor="middle" fontSize="13" fill="#b08d57">
                ♥
              </text>

              {/* Ruedas: giran con el recorrido (refs desde el scroll). */}
              <g ref={ruedaTraseraRef} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                <circle cx="96" cy="118" r="19" fill="#fdfaf3" stroke="#b08d57" strokeWidth="2" />
                <line x1="96" y1="102" x2="96" y2="134" stroke="rgba(138,106,63,0.55)" strokeWidth="1.5" />
                <line x1="80" y1="118" x2="112" y2="118" stroke="rgba(138,106,63,0.55)" strokeWidth="1.5" />
                <line x1="85" y1="107" x2="107" y2="129" stroke="rgba(138,106,63,0.35)" strokeWidth="1.5" />
                <line x1="107" y1="107" x2="85" y2="129" stroke="rgba(138,106,63,0.35)" strokeWidth="1.5" />
                <circle cx="96" cy="118" r="4" fill="#8a6a3f" />
              </g>
              <g ref={ruedaDelanteraRef} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                <circle cx="204" cy="118" r="19" fill="#fdfaf3" stroke="#b08d57" strokeWidth="2" />
                <line x1="204" y1="102" x2="204" y2="134" stroke="rgba(138,106,63,0.55)" strokeWidth="1.5" />
                <line x1="188" y1="118" x2="220" y2="118" stroke="rgba(138,106,63,0.55)" strokeWidth="1.5" />
                <line x1="193" y1="107" x2="215" y2="129" stroke="rgba(138,106,63,0.35)" strokeWidth="1.5" />
                <line x1="215" y1="107" x2="193" y2="129" stroke="rgba(138,106,63,0.35)" strokeWidth="1.5" />
                <circle cx="204" cy="118" r="4" fill="#8a6a3f" />
              </g>
            </svg>
          </span>
        </button>
      </div>

      <p className="mt-1 px-6 text-center text-[12px] italic text-[#a59c8a]">
        El carrito avanza con vos por la invitación — y pssst… tocalo.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. La cuenta regresiva                                              */
/* ------------------------------------------------------------------ */

function suscribirCadaSegundo(alCambiar: () => void) {
  const id = window.setInterval(alCambiar, 1000);
  return () => window.clearInterval(id);
}

/** "4:00 p. m.", "3 pm" o "16:00" → horas y minutos del día. */
function horaDelDia(hora: string | null): { hh: number; mm: number } {
  if (!hora) return { hh: 0, mm: 0 };
  const m = hora.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])?/i);
  if (!m) return { hh: 0, mm: 0 };
  let hh = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  const sufijo = m[3]?.toLowerCase();
  if (sufijo === "p" && hh < 12) hh += 12;
  if (sufijo === "a" && hh === 12) hh = 0;
  return { hh: Math.min(23, hh), mm: Math.min(59, mm) };
}

/**
 * Días / horas / min / seg hasta la fecha del evento, en cuatro
 * tarjetitas glass. Se actualiza cada segundo; cuando un número
 * cambia, el span se remonta (key) y hace el "tick". Si ya llegó el
 * día, celebra en vez de contar.
 */
export function CuentaRegresiva({
  fechaIso,
  hora,
}: {
  fechaIso: string;
  hora: string | null;
}) {
  const objetivo = useMemo(() => {
    const [y, m, d] = fechaIso.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return Number.NaN;
    const { hh, mm } = horaDelDia(hora);
    return new Date(y, m - 1, d, hh, mm).getTime();
  }, [fechaIso, hora]);

  // El reloj como "external store": el servidor no sabe la hora del
  // visitante (null) y en el cliente el snapshot cambia cada segundo.
  const ahora = useSyncExternalStore<number | null>(
    suscribirCadaSegundo,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => null,
  );

  if (!Number.isFinite(objetivo)) return null;

  const restante = ahora === null ? null : objetivo - ahora;
  if (restante !== null && restante <= 0) {
    return (
      <div data-reveal className="w-full">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b08d57] md:text-[12px]">
          Cuenta regresiva
        </p>
        <p className="inv3-serif mt-3 text-[clamp(24px,5.4vw,30px)] text-[#3d3a35] md:text-[clamp(30px,3.4vw,48px)]">
          ¡Llegó el gran día!
        </p>
      </div>
    );
  }

  const seg = restante === null ? null : Math.floor(restante / 1000);
  const unidades =
    seg === null
      ? [
          { etiqueta: "Días", valor: "–" },
          { etiqueta: "Horas", valor: "–" },
          { etiqueta: "Min", valor: "–" },
          { etiqueta: "Seg", valor: "–" },
        ]
      : [
          { etiqueta: "Días", valor: String(Math.floor(seg / 86400)) },
          { etiqueta: "Horas", valor: String(Math.floor(seg / 3600) % 24).padStart(2, "0") },
          { etiqueta: "Min", valor: String(Math.floor(seg / 60) % 60).padStart(2, "0") },
          { etiqueta: "Seg", valor: String(seg % 60).padStart(2, "0") },
        ];

  return (
    <div data-reveal className="w-full">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b08d57] md:text-[12px]">
        Cuenta regresiva
      </p>
      <div className="mx-auto mt-4 grid w-full max-w-[440px] grid-cols-4 gap-2 sm:gap-2.5 md:mt-7 md:max-w-[640px] md:gap-4">
        {unidades.map((u) => (
          <div
            key={u.etiqueta}
            className="rounded-2xl border border-[#d9c9a8] bg-white/70 px-1 py-3.5 sm:py-4 md:py-7"
          >
            {/* El key con el valor remonta el span → tick al cambiar. */}
            <span
              key={`${u.etiqueta}-${u.valor}`}
              className="inv2-anim-tick inv3-serif block text-[clamp(23px,6.2vw,32px)] leading-none tabular-nums text-[#3d3a35] md:text-[clamp(34px,3.2vw,52px)]"
            >
              {u.valor}
            </span>
            <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8378] md:mt-2.5 md:text-[11.5px]">
              {u.etiqueta}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. El ambiente: pétalos y destellos en dos capas                    */
/* ------------------------------------------------------------------ */

/** Pseudo-azar determinista (mismo resultado en servidor y cliente). */
function azar(i: number, sal: number): number {
  const x = Math.sin(i * 127.1 + sal * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type Particula = {
  left: number;
  dur: number;
  delay: number;
  drift: number;
  giro: number;
  tam: number;
  esPetalo: boolean;
};

function capaDeParticulas(n: number, sal: number, lenta: boolean): Particula[] {
  return Array.from({ length: n }, (_, i) => ({
    left: azar(i, sal) * 100,
    dur: lenta ? 16 + azar(i, sal + 1) * 8 : 9 + azar(i, sal + 1) * 6,
    delay: -azar(i, sal + 2) * 24,
    drift: (azar(i, sal + 3) - 0.5) * 90,
    giro: 200 + azar(i, sal + 4) * 300,
    tam: lenta ? 6 + azar(i, sal + 5) * 5 : 9 + azar(i, sal + 5) * 7,
    esPetalo: azar(i, sal + 6) > 0.4,
  }));
}

/**
 * Dos capas fijas de pétalos y destellos cayendo a velocidades
 * distintas (parallax). En dispositivos con giroscopio que no exigen
 * permiso (Android; en iOS requestPermission existe y entonces no se
 * activa) las capas se corren sutilmente con la inclinación. Caen
 * siempre: acá no se consulta la señal de movimiento reducido.
 */
export function AmbienteParticulas() {
  const capaAtrasRef = useRef<HTMLDivElement | null>(null);
  const capaFrenteRef = useRef<HTMLDivElement | null>(null);

  const capas = useMemo(
    () => ({
      atras: capaDeParticulas(10, 1, true),
      frente: capaDeParticulas(9, 7, false),
    }),
    [],
  );

  useEffect(() => {
    const Doe = window.DeviceOrientationEvent as unknown as
      | { requestPermission?: () => Promise<string> }
      | undefined;
    // iOS pide permiso explícito → ahí simplemente no se activa.
    if (!Doe || typeof Doe.requestPermission === "function") return;
    let frame = 0;
    let gx = 0;
    let gy = 0;
    const pintar = () => {
      frame = 0;
      if (capaAtrasRef.current) {
        capaAtrasRef.current.style.transform = `translate3d(${gx * 6}px, ${gy * 6}px, 0)`;
      }
      if (capaFrenteRef.current) {
        capaFrenteRef.current.style.transform = `translate3d(${gx * 14}px, ${gy * 14}px, 0)`;
      }
    };
    const alInclinar = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      gx = Math.max(-1, Math.min(1, e.gamma / 28));
      // 45° ≈ cómo se sostiene el teléfono normalmente.
      gy = Math.max(-1, Math.min(1, (e.beta - 45) / 28));
      if (!frame) frame = window.requestAnimationFrame(pintar);
    };
    window.addEventListener("deviceorientation", alInclinar);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("deviceorientation", alInclinar);
    };
  }, []);

  const pintarCapa = (particulas: Particula[], opacidad: number, prefijo: string) =>
    particulas.map((p, i) => (
      <span
        key={`${prefijo}-${i}`}
        className="inv2-anim-caer absolute top-0 block"
        style={
          {
            left: `${p.left}%`,
            width: p.esPetalo ? p.tam : p.tam * 0.5,
            height: p.esPetalo ? p.tam * 1.3 : p.tam * 0.5,
            borderRadius: p.esPetalo ? "80% 6px 80% 6px" : "9999px",
            background: p.esPetalo
              ? "linear-gradient(135deg, rgba(255,253,248,0.95), rgba(201,169,106,0.55))"
              : "rgba(176,141,87,0.5)",
            boxShadow: p.esPetalo
              ? "0 1px 2px rgba(138,106,63,0.18)"
              : "0 0 8px rgba(201,169,106,0.8)",
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            "--inv2-drift": `${p.drift}px`,
            "--inv2-giro": `${p.giro}deg`,
            "--inv2-op": opacidad,
          } as CSSProperties
        }
      />
    ));

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        ref={capaAtrasRef}
        className="absolute inset-0"
        style={{ transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {pintarCapa(capas.atras, 0.45, "a")}
      </div>
      <div
        ref={capaFrenteRef}
        className="absolute inset-0"
        style={{ transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {pintarCapa(capas.frente, 0.75, "f")}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. El confetti del "Sí asistiré"                                    */
/* ------------------------------------------------------------------ */

const COLORES_CONFETTI = ["#b08d57", "#c9a96a", "#ffffff", "#e6d7b2", "#8a6a3f", "#efe6d2"];

/**
 * El estallido sobre el mensaje de gracias cuando confirman que SÍ
 * van: ~36 piezas absolutas en dorado, champán y blanco, sembradas con
 * el mismo pseudo-azar determinista de las partículas (render puro).
 */
export function ConfettiRsvp() {
  const piezas = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: azar(i, 21) * 100,
        color: COLORES_CONFETTI[i % COLORES_CONFETTI.length],
        dur: 1.1 + azar(i, 22) * 0.9,
        delay: azar(i, 23) * 0.35,
        dx: (azar(i, 24) - 0.5) * 90,
        giro: 360 + azar(i, 25) * 540,
        ancho: 6 + azar(i, 26) * 5,
        alto: 8 + azar(i, 27) * 7,
        redonda: azar(i, 28) > 0.7,
      })),
    [],
  );

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 block overflow-hidden rounded-3xl">
      {piezas.map((p, i) => (
        <span
          key={i}
          className="inv2-anim-confetti absolute top-[-14px] block"
          style={
            {
              left: `${p.left}%`,
              width: p.ancho,
              height: p.redonda ? p.ancho : p.alto,
              background: p.color,
              borderRadius: p.redonda ? "9999px" : "2px",
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              "--inv2-dx": `${p.dx}px`,
              "--inv2-giro": `${p.giro}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
