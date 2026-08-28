"use client";

import { useEffect, useRef, useState } from "react";
import "./historia.css";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA HISTORIA DE LEALTAD — el teléfono que cuenta el producto
 * ════════════════════════════════════════════════════════════════════
 *
 * El corazón de /lealtad/ayuda (28 ago 2026): una escena de scroll
 * storytelling tipo página de producto de Apple. Cuatro bloques de
 * texto pasan por la izquierda; a la derecha UN teléfono sticky cambia
 * de pantalla, gira y respira: el configurador, el QR con las clientas
 * registrándose, el mostrador premiando y las notificaciones.
 *
 * ── EL MOTOR: UN DATO, CERO RE-RENDERS ──────────────────────────────
 *
 * Por scroll, el JS escribe exactamente dos cosas: `data-fase` en la
 * escena y el `transform` del teléfono (interpolado entre poses).
 * Nada de estado de React en el camino caliente — los selectores de
 * historia.css deciden qué pantalla, qué texto y qué punto del riel se
 * encienden a partir de ese único dato. Transform y opacity solamente:
 * nada que toque layout, que es de donde salen los 60 fps.
 *
 * ── EN EL TELÉFONO NO HAY STICKY ────────────────────────────────────
 *
 * Bajo `lg` la escena se apila: cada bloque trae su PROPIA pantalla
 * dibujada debajo del texto. No es una degradación — es la experiencia
 * específica de pantalla vertical que pidió el encargo: el teléfono
 * sigue siendo el protagonista, solo que uno por paso.
 *
 * ── LOS NÚMEROS SON DE MUESTRA ──────────────────────────────────────
 *
 * «Mi Café», María Rodríguez y los 1.284 clientes son utilería de la
 * demo, como en toda la familia mockup-* de la landing: enseñan el
 * producto, no presumen cifras de Bookea (la regla de «no inventar
 * cifras» aplica a la plataforma, no al lorem de un mockup — y la
 * sección de analytics lo dice con su pastilla de «ejemplo»).
 */

/* ─────────────────────────── utilería ─────────────────────────── */

const NAVY = "#16295e";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function suavizar(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Un QR de utilería: dibujo, no dato (mismo criterio que el póster). */
function QrDibujo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 29 29" className={className} aria-hidden>
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
      {[
        [9, 1], [11, 2], [13, 0], [15, 3], [17, 1], [19, 2], [9, 5], [12, 6],
        [16, 5], [18, 6], [1, 9], [3, 11], [5, 10], [2, 14], [6, 13], [4, 16],
        [1, 18], [5, 19], [9, 9], [11, 10], [13, 12], [15, 9], [17, 11],
        [19, 13], [21, 10], [23, 12], [25, 9], [27, 11], [24, 15], [26, 17],
        [10, 15], [12, 17], [14, 14], [16, 16], [18, 18], [20, 15], [9, 21],
        [11, 23], [13, 25], [15, 22], [17, 24], [19, 26], [21, 21], [23, 23],
        [25, 25], [27, 22], [22, 27], [26, 20],
      ].map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width="1.6" height="1.6" fill="#101828" />
      ))}
    </svg>
  );
}

/** El marco del teléfono protagonista. */
export function TelefonoMarco({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative w-[262px] sm:w-[282px] ${className}`}>
      <div className="overflow-hidden rounded-[42px] border-[8px] border-[#0a1226] bg-white shadow-[0_60px_120px_-45px_rgba(10,18,38,0.55)]">
        <div className="relative h-[520px] bg-[#f7f8fb] sm:h-[556px]">
          <span
            aria-hidden
            className="absolute left-1/2 top-2.5 z-10 h-[20px] w-[86px] -translate-x-1/2 rounded-full bg-[#0a1226]"
          />
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── las pantallas del teléfono ─────────────────── */

/** La tarjeta digital — héroe y cierre. */
export function PantallaTarjeta() {
  return (
    <div className="absolute inset-0 flex flex-col px-4 pb-5 pt-10">
      <p className="text-center text-[22px] font-extrabold tabular-nums text-[#0d1733]">9:41</p>
      <div className="hl-notif-hero mt-2 rounded-xl bg-white px-3 py-2 shadow-md">
        <p className="text-[8.5px] font-extrabold uppercase tracking-wide text-[#2563eb]">
          Bookea Lealtad
        </p>
        <p className="text-[11px] font-bold leading-tight text-[#0d1733]">
          ¡Sello nuevo! Te faltan 3 para tu café gratis ☕
        </p>
      </div>
      <div
        className="mt-4 rounded-2xl p-4 text-white shadow-lg"
        style={{ background: `linear-gradient(150deg, ${NAVY} 0%, #0f4c9e 100%)` }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-extrabold">Mi Café</p>
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-white text-[11px] font-extrabold text-[#16295e]">
            b
          </span>
        </div>
        <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.16em] text-white/70">
          Tus sellos
        </p>
        <div className="mt-2 flex gap-1.5">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className={`grid h-[19px] w-[19px] place-items-center rounded-full border text-[9px] ${
                i < 7 ? "border-white bg-white text-[#16295e]" : "border-white/40 text-white/30"
              }`}
            >
              {i < 7 ? "☕" : ""}
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-[12px] font-extrabold">7 / 10 sellos</p>
        <p className="mt-0.5 text-[10.5px] font-semibold text-white/75">
          3 visitas más y tenés tu recompensa
        </p>
      </div>
      <p className="mt-auto text-center text-[9.5px] font-bold text-[#8a91a4]">
        Vive en Apple Wallet y Google Wallet
      </p>
    </div>
  );
}

/** Fase 0 · el configurador del plan. */
function PantallaConfigurador() {
  return (
    <div className="absolute inset-0 flex flex-col px-4 pb-4 pt-10">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8a91a4]">
        Tu panel
      </p>
      <p className="mt-0.5 text-[14.5px] font-extrabold text-[#0d1733]">Crear plan de lealtad</p>

      <p className="mt-3.5 text-[9px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
        Nombre del programa
      </p>
      <div className="mt-1 rounded-lg border border-[#e6eaf3] bg-white px-2.5 py-2 text-[12px] font-bold text-[#0d1733]">
        Club Café<span className="hl-caret text-[#2563eb]">|</span>
      </div>

      <p className="mt-3 text-[9px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
        Tipo de recompensa
      </p>
      <div className="mt-1 flex flex-col gap-1">
        {[
          ["Sellos", true],
          ["Puntos", false],
          ["Cashback", false],
        ].map(([n, activo]) => (
          <div
            key={n as string}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold ${
              activo
                ? "border-[#2563eb] bg-[#eef4ff] text-[#0d1733]"
                : "border-[#e6eaf3] bg-white text-[#8a91a4]"
            }`}
          >
            <span
              className={`grid h-3.5 w-3.5 place-items-center rounded-full border text-[8px] ${
                activo ? "border-[#2563eb] bg-[#2563eb] text-white" : "border-[#c7cede]"
              }`}
            >
              {activo ? "✓" : ""}
            </span>
            {n}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[9px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
        Recompensa
      </p>
      <div className="mt-1 rounded-lg border border-[#e6eaf3] bg-white px-2.5 py-2 text-[12px] font-bold text-[#0d1733]">
        10 sellos = Café gratis
      </div>

      <button
        type="button"
        tabIndex={-1}
        className="mt-auto w-full rounded-xl py-2.5 text-[12.5px] font-extrabold text-white"
        style={{ background: NAVY }}
      >
        Crear plan
      </button>
    </div>
  );
}

/** Fase 1 · el QR y las clientas entrando. */
function PantallaRegistro() {
  return (
    <div className="absolute inset-0 flex flex-col px-4 pb-4 pt-10">
      <p className="text-center text-[13px] font-extrabold text-[#0d1733]">
        Escaneá y llevate tu tarjeta
      </p>
      <div className="relative mx-auto mt-2.5 h-[118px] w-[118px] rounded-xl bg-white p-2 shadow-md">
        <QrDibujo className="h-full w-full" />
        <span className="hl-escaner absolute inset-x-2 h-[2.5px] rounded-full bg-[#2563eb]/80 shadow-[0_0_10px_rgba(37,99,235,0.8)]" />
      </div>

      <p className="mt-4 text-[9px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
        Registrándose ahora
      </p>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {[
          ["MR", "María R.", "hl-registro-1"],
          ["CA", "Carlos A.", "hl-registro-2"],
          ["AN", "Andrea N.", "hl-registro-3"],
        ].map(([ini, nombre, clase]) => (
          <div key={ini} className={`${clase} flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 shadow-sm`}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eef4ff] text-[9px] font-extrabold text-[#16295e]">
              {ini}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#0d1733]">{nombre}</span>
            <span className="shrink-0 text-[9px] font-extrabold text-emerald-600">✓ Con tarjeta</span>
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-xl bg-[#0d1733] px-3 py-2.5 text-white">
        <p className="text-[8.5px] font-extrabold uppercase tracking-wide text-white/60">
          Tu base de clientes
        </p>
        <p className="text-[16px] font-extrabold tabular-nums">1.284 personas</p>
      </div>
    </div>
  );
}

/** Fase 2 · el mostrador premiando. */
function PantallaPremiar() {
  return (
    <div className="absolute inset-0 flex flex-col px-4 pb-4 pt-10">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8a91a4]">Cliente</p>
      <div className="mt-1 flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 shadow-sm">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef4ff] text-[11px] font-extrabold text-[#16295e]">
          MR
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-extrabold text-[#0d1733]">
            María Rodríguez
          </span>
          <span className="block text-[9.5px] font-bold text-[#8a91a4]">
            8 visitas · última: hoy
          </span>
        </span>
      </div>

      <p className="mt-3.5 text-[9px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
        Entregar recompensa
      </p>
      <div className="mt-1.5 flex flex-col gap-1.5">
        <div
          className="hl-boton-press rounded-xl px-3 py-2.5 text-center text-[12.5px] font-extrabold text-white"
          style={{ background: NAVY }}
        >
          +1 sello
        </div>
        <div className="rounded-xl border border-[#e6eaf3] bg-white px-3 py-2 text-center text-[11.5px] font-bold text-[#8a91a4]">
          +100 puntos
        </div>
        <div className="rounded-xl border border-[#e6eaf3] bg-white px-3 py-2 text-center text-[11.5px] font-bold text-[#8a91a4]">
          +₡500 cashback
        </div>
      </div>

      <div className="mt-3.5 rounded-xl bg-white px-3 py-2.5 shadow-sm">
        <p className="text-[8.5px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
          La tarjeta de María
        </p>
        <div className="mt-1.5 flex gap-1">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className={`grid h-[16px] w-[16px] place-items-center rounded-full border text-[8px] ${
                i < 7
                  ? "border-[#16295e] bg-[#16295e] text-white"
                  : i === 7
                    ? "hl-sello-pop border-[#2563eb] bg-[#2563eb] text-white"
                    : "border-[#c7cede] text-transparent"
              }`}
            >
              ✓
            </span>
          ))}
        </div>
      </div>

      <div className="hl-toast-premio mt-auto rounded-xl bg-emerald-50 px-3 py-2 text-center">
        <p className="text-[11px] font-extrabold text-emerald-700">¡Recompensa agregada!</p>
        <p className="text-[9.5px] font-semibold text-emerald-700/80">
          Su próximo premio está más cerca.
        </p>
      </div>
    </div>
  );
}

/** Fase 3 · las notificaciones que hacen volver. */
function PantallaNotificaciones() {
  return (
    <div className="absolute inset-0 flex flex-col px-4 pb-4 pt-10">
      <p className="text-center text-[26px] font-extrabold tabular-nums text-[#0d1733]">9:41</p>
      <p className="text-center text-[9.5px] font-bold text-[#8a91a4]">miércoles 20 de agosto</p>
      <div className="mt-3 flex flex-col gap-1.5">
        {[
          ["🎉", "Tenemos algo especial para vos", "20% de descuento toda esta semana", "hl-notif-a"],
          ["☕", "Tu recompensa está esperando", "Te falta 1 sello para tu café gratis", "hl-notif-b"],
          ["🔥", "Doble puntuación este viernes", "Cada visita vale por dos", "hl-notif-c"],
          ["💛", "Te extrañamos", "Tenemos algo para tu próxima visita", "hl-notif-d"],
        ].map(([emoji, titulo, texto, clase]) => (
          <div key={clase} className={`${clase} rounded-xl bg-white px-3 py-2 shadow-md`}>
            <p className="flex items-center gap-1.5 text-[8.5px] font-extrabold uppercase tracking-wide text-[#2563eb]">
              <span>{emoji}</span> Bookea Lealtad · ahora
            </p>
            <p className="text-[11.5px] font-extrabold leading-tight text-[#0d1733]">{titulo}</p>
            <p className="text-[10px] font-semibold leading-tight text-[#5b6478]">{texto}</p>
          </div>
        ))}
      </div>
      <p className="mt-auto text-center text-[9px] font-bold text-[#8a91a4]">
        Directo a la tarjeta que ya tienen en el Wallet
      </p>
    </div>
  );
}

const PANTALLAS = [
  PantallaConfigurador,
  PantallaRegistro,
  PantallaPremiar,
  PantallaNotificaciones,
];

/* ────────────────────────── la escena ────────────────────────── */

/** Las poses del teléfono por fase (la 5.ª es la salida). */
const POSES = [
  { s: 0.97, r: -5, y: 10 },
  { s: 1.05, r: 4, y: -6 },
  { s: 1.0, r: -3, y: 6 },
  { s: 1.08, r: 0, y: -10 },
  { s: 1.03, r: 0, y: 0 },
];

const FASES: {
  paso: string;
  rail: string;
  titulo: string;
  parrafos: React.ReactNode[];
}[] = [
  {
    paso: "Paso 01",
    rail: "Crear",
    titulo: "Creá tu plan de lealtad.",
    parrafos: [
      <>Vos decidís cómo premiar a tus clientes: sellos, puntos, cashback, recompensas o promociones.</>,
      <>Elegís el premio, tus colores y tu logo — y la tarjeta queda viva en el Wallet de tus clientes.</>,
    ],
  },
  {
    paso: "Paso 02",
    rail: "Registrar",
    titulo: "Un QR. Una nueva relación con tu cliente.",
    parrafos: [
      <>Imprimí tu código QR y ponelo en tu negocio. Tus clientes lo escanean, se registran solos y se llevan su tarjeta digital.</>,
      <>
        <strong className="font-extrabold text-[#0d1733]">Cada visita genera información que podés usar:</strong>{" "}
        quiénes son tus mejores clientes, quiénes vuelven seguido y quiénes dejaron de venir.
      </>,
    ],
  },
  {
    paso: "Paso 03",
    rail: "Premiar",
    titulo: "Cada visita puede convertirse en una recompensa.",
    parrafos: [
      <>Desde tu celular premiás en segundos: identificás al cliente, tocás un botón y el sello cae en su tarjeta al instante.</>,
      <>Vos o cualquiera de tu equipo — sin cuadernos, sin tarjetas de cartón.</>,
    ],
  },
  {
    paso: "Paso 04",
    rail: "Regresar",
    titulo: "No esperés a que vuelvan. Deciles que vuelvan.",
    parrafos: [
      <>Descuentos, productos nuevos, promos del día: lo escribís una vez y llega directo al teléfono de tus clientes registrados.</>,
      <>Tu cliente ya estuvo en tu negocio. Ahora podés volver a hablarle.</>,
    ],
  },
];

export default function HistoriaLealtad() {
  const escenaRef = useRef<HTMLDivElement | null>(null);
  const telefonoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const escena = escenaRef.current;
    if (!escena) return;
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let pedido = 0;
    const pintar = () => {
      pedido = 0;
      const alto = escena.offsetHeight - window.innerHeight;
      if (alto <= 0) return;
      const p = Math.min(1, Math.max(0, -escena.getBoundingClientRect().top / alto));
      const cruda = p * FASES.length;
      const fase = Math.min(FASES.length - 1, Math.floor(cruda));
      if (escena.dataset.fase !== String(fase)) escena.dataset.fase = String(fase);

      if (!reducir && telefonoRef.current) {
        const t = suavizar(Math.min(1, cruda - fase));
        const a = POSES[fase];
        const b = POSES[fase + 1];
        telefonoRef.current.style.transform = `rotate(${lerp(a.r, b.r, t).toFixed(2)}deg) scale(${lerp(a.s, b.s, t).toFixed(3)}) translateY(${lerp(a.y, b.y, t).toFixed(1)}px)`;
      }
    };
    const alScroll = () => {
      if (!pedido) pedido = requestAnimationFrame(pintar);
    };
    pintar();
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll);
    return () => {
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
      if (pedido) cancelAnimationFrame(pedido);
    };
  }, []);

  return (
    <div ref={escenaRef} data-fase="0" className="hl-escena relative" id="historia">
      <div className="mx-auto grid w-full max-w-[1180px] px-5 lg:grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
        {/* ── El riel de progreso, quieto mientras la escena corre ── */}
        <div className="hidden lg:block">
          <div className="sticky top-0 flex h-screen flex-col justify-center gap-5">
            {FASES.map((f, i) => (
              <div key={f.rail} data-p={i} className="hl-rail-item flex items-center gap-2.5">
                <span className="hl-rail-barra block h-[3px] rounded-full" />
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[#16295e]">
                  0{i + 1} · {f.rail}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Los cuatro bloques de texto (y, en el teléfono, su
            pantalla propia debajo de cada uno) ─────────────────────── */}
        <div>
          {FASES.map((f, i) => {
            const Pantalla = PANTALLAS[i];
            return (
              <div
                key={f.paso}
                data-p={i}
                className="hl-bloque flex min-h-[92svh] flex-col justify-center py-14 lg:min-h-screen"
              >
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#2563eb]">
                  {f.paso}
                </p>
                <h2 className="titulo mt-3 text-[clamp(26px,3.6vw,42px)] font-extrabold leading-[1.06] text-[#0d1733]">
                  {f.titulo}
                </h2>
                <div className="mt-4 flex max-w-[46ch] flex-col gap-3 text-[15.5px] leading-relaxed text-[#5b6478]">
                  {f.parrafos.map((tx, j) => (
                    <p key={j}>{tx}</p>
                  ))}
                </div>
                {/* La experiencia del teléfono: una pantalla por paso,
                    sin sticky — ver la cabecera. */}
                <div className="mt-8 flex justify-center lg:hidden">
                  <TelefonoMarco>
                    <div className="absolute inset-0">
                      <Pantalla />
                    </div>
                  </TelefonoMarco>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── El teléfono sticky (solo escritorio) ─────────────────── */}
        <div className="hidden lg:block">
          <div className="sticky top-0 flex h-screen items-center justify-center">
            <div className="relative">
              <div ref={telefonoRef} style={{ willChange: "transform" }}>
                <TelefonoMarco>
                  {PANTALLAS.map((Pantalla, i) => (
                    <div key={i} data-p={i} className="hl-pantalla absolute inset-0">
                      <Pantalla />
                    </div>
                  ))}
                </TelefonoMarco>
              </div>

              {/* Las cifras flotando alrededor del teléfono cuando las
                  clientas se vuelven datos (fase 1). */}
              <div className="hl-chip-flotante hl-flotar absolute -left-40 top-16 rounded-2xl border border-[#e6eaf3] bg-white px-3.5 py-2.5 shadow-lg">
                <p className="text-[17px] font-extrabold tabular-nums text-[#0d1733]">1.284</p>
                <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#8a91a4]">Clientes</p>
              </div>
              <div className="hl-chip-flotante hl-flotar absolute -right-40 top-40 rounded-2xl border border-[#e6eaf3] bg-white px-3.5 py-2.5 shadow-lg" style={{ animationDelay: "1.2s" }}>
                <p className="text-[17px] font-extrabold tabular-nums text-[#0d1733]">342</p>
                <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#8a91a4]">Frecuentes</p>
              </div>
              <div className="hl-chip-flotante hl-flotar absolute -left-32 bottom-24 rounded-2xl border border-[#e6eaf3] bg-white px-3.5 py-2.5 shadow-lg" style={{ animationDelay: "2.1s" }}>
                <p className="text-[17px] font-extrabold tabular-nums text-[#0d1733]">+156</p>
                <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#8a91a4]">Nuevos este mes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── piezas para el resto de la página ──────────────── */

/**
 * Enciende `hl-activo` cuando la sección entra en vista (una sola
 * vez): las barras crecen y las revelaciones suben. Es el hermano
 * mínimo del RevealOnScroll de la portada, con clases propias.
 */
export function SeccionViva({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            el.classList.add("hl-activo");
            ob.disconnect();
          }
        }
      },
      { threshold: 0.25 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Un número que cuenta hasta su valor la primera vez que se ve. */
export function Contador({
  hasta,
  prefijo = "",
  sufijo = "",
  decimales = 0,
  className = "",
}: {
  hasta: number;
  prefijo?: string;
  sufijo?: string;
  decimales?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [valor, setValor] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // La decisión de reduced-motion se aplica DENTRO del callback del
    // observer (asíncrono): un setState síncrono dentro del efecto es
    // justo lo que la regla del compilador de React prohíbe.
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const ob = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        ob.disconnect();
        if (reducir) {
          setValor(hasta);
          return;
        }
        const arranque = performance.now();
        const durar = 1200;
        const tick = (ahora: number) => {
          const t = Math.min(1, (ahora - arranque) / durar);
          setValor(hasta * (1 - Math.pow(1 - t, 3)));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    ob.observe(el);
    return () => {
      ob.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hasta]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefijo}
      {valor.toLocaleString("es-CR", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      })}
      {sufijo}
    </span>
  );
}
